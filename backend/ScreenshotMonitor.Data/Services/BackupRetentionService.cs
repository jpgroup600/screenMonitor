using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public record BackupRetentionResult(int DeletedVersions, int QueuedObjects, int DeletedObjects, int FailedObjects);

public class BackupRetentionService(SmDbContext db, IBackupObjectStorage storage, TimeProvider timeProvider)
{
    public async Task<BackupRetentionResult> ApplyAsync(string deviceId, int retentionDays, long maxBackupBytes,
        int maxVersionsPerFile, CancellationToken cancellationToken = default)
    {
        Validate(retentionDays, maxBackupBytes, maxVersionsPerFile);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var cutoff = now.AddDays(-retentionDays);
        var files = await db.BackupFiles.Where(x => x.DeviceId == deviceId)
            .Include(x => x.Versions).ThenInclude(x => x.RestoreRequests).ToListAsync(cancellationToken);
        var candidates = new HashSet<FileVersion>();

        foreach (var file in files)
        {
            var ordered = file.Versions.OrderByDescending(x => x.UploadedAt).ToList();
            foreach (var version in ordered.Where((version, index) =>
                !IsProtected(version) && (version.UploadedAt < cutoff || index >= maxVersionsPerFile)))
                candidates.Add(version);
        }

        var remaining = files.SelectMany(x => x.Versions).Where(x => !candidates.Contains(x)).ToList();
        var totalBytes = remaining.Sum(x => x.EncryptedSizeBytes);
        foreach (var version in remaining.Where(x => !IsProtected(x)).OrderBy(x => x.UploadedAt))
        {
            if (totalBytes <= maxBackupBytes) break;
            candidates.Add(version);
            totalBytes -= version.EncryptedSizeBytes;
        }

        var objectKeys = candidates.Select(x => x.ObjectKey).Distinct().ToList();
        db.FileVersions.RemoveRange(candidates);
        foreach (var file in files.Where(file => file.Versions.All(candidates.Contains))) db.BackupFiles.Remove(file);
        foreach (var objectKey in objectKeys)
        {
            if (!await db.StorageDeletionJobs.AnyAsync(x => x.ObjectKey == objectKey, cancellationToken))
                db.StorageDeletionJobs.Add(new StorageDeletionJob { ObjectKey = objectKey, CreatedAt = now, NextAttemptAt = now });
        }
        await db.SaveChangesAsync(cancellationToken);
        var (deleted, failed) = await ProcessDeletionQueueAsync(cancellationToken);
        return new BackupRetentionResult(candidates.Count, objectKeys.Count, deleted, failed);
    }

    public async Task<(int Deleted, int Failed)> ProcessDeletionQueueAsync(CancellationToken cancellationToken = default)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var jobs = await db.StorageDeletionJobs.Where(x => x.NextAttemptAt <= now)
            .OrderBy(x => x.CreatedAt).Take(100).ToListAsync(cancellationToken);
        var deleted = 0;
        var failed = 0;
        foreach (var job in jobs)
        {
            if (await db.FileVersions.AnyAsync(x => x.ObjectKey == job.ObjectKey, cancellationToken))
            {
                db.StorageDeletionJobs.Remove(job);
                continue;
            }
            try
            {
                await storage.DeleteAsync(job.ObjectKey, cancellationToken);
                db.StorageDeletionJobs.Remove(job);
                deleted++;
            }
            catch (Exception error)
            {
                job.Attempts++;
                job.LastError = error.Message.Length > 2048 ? error.Message[..2048] : error.Message;
                job.NextAttemptAt = now.AddMinutes(Math.Min(24 * 60, Math.Pow(2, Math.Min(job.Attempts, 10))));
                failed++;
            }
        }
        await db.SaveChangesAsync(cancellationToken);
        return (deleted, failed);
    }

    private static bool IsProtected(FileVersion version) =>
        version.RestoreRequests.Any(request => request.Status == "Pending");

    private static void Validate(int retentionDays, long maxBackupBytes, int maxVersionsPerFile)
    {
        if (retentionDays is < 1 or > 3650) throw new ArgumentOutOfRangeException(nameof(retentionDays));
        if (maxBackupBytes < 1024 * 1024) throw new ArgumentOutOfRangeException(nameof(maxBackupBytes));
        if (maxVersionsPerFile is < 1 or > 1000) throw new ArgumentOutOfRangeException(nameof(maxVersionsPerFile));
    }
}
