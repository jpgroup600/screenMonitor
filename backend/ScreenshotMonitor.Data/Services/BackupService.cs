using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public partial class BackupService(SmDbContext db, IBackupObjectStorage storage, TimeProvider timeProvider)
{
    public Task<List<BackupFile>> ListAsync(string? search = null, int take = 200)
    {
        var query = db.BackupFiles.AsNoTracking().Include(x => x.Employee).Include(x => x.Versions).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) {
            var keyword = search.Trim().ToLower();
            query = query.Where(x => x.OriginalPath.ToLower().Contains(keyword)
                || x.DeviceId.ToLower().Contains(keyword) || x.Employee.FullName.ToLower().Contains(keyword));
        }
        return query.OrderByDescending(x => x.Versions.Max(v => v.UploadedAt)).Take(Math.Clamp(take, 1, 500)).ToListAsync();
    }

    public Task<BackupFile?> GetAsync(string id) => db.BackupFiles.AsNoTracking().Include(x => x.Employee)
        .Include(x => x.Versions.OrderByDescending(v => v.UploadedAt)).FirstOrDefaultAsync(x => x.Id == id);

    public async Task<(FileVersion Version, bool Deduplicated)> UploadAsync(
        string employeeId, string deviceId, string originalPath, string contentHash,
        long plainSizeBytes, DateTime sourceModifiedAt, Stream encryptedContent,
        long encryptedSizeBytes, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(deviceId) || string.IsNullOrWhiteSpace(originalPath))
            throw new ArgumentException("DeviceId and original path are required.");
        contentHash = contentHash.Trim().ToLowerInvariant();
        if (!Sha256Regex().IsMatch(contentHash)) throw new ArgumentException("ContentHash must be a SHA-256 hex value.");
        if (plainSizeBytes < 0 || encryptedSizeBytes <= 0) throw new ArgumentException("File sizes are invalid.");

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var existing = await db.FileVersions.AsNoTracking()
            .Include(x => x.BackupFile)
            .FirstOrDefaultAsync(x => x.ContentHash == contentHash && x.BackupFile.EmployeeId == employeeId, cancellationToken);
        var file = await db.BackupFiles.FirstOrDefaultAsync(
            x => x.EmployeeId == employeeId && x.DeviceId == deviceId && x.OriginalPath == originalPath,
            cancellationToken);
        if (file is null)
        {
            file = new BackupFile { EmployeeId = employeeId, DeviceId = deviceId, OriginalPath = originalPath, FirstSeenAt = now, LastSeenAt = now };
            db.BackupFiles.Add(file);
        }
        else file.LastSeenAt = now;

        var objectKey = existing?.ObjectKey ?? $"employees/{employeeId}/devices/{deviceId}/{contentHash[..2]}/{contentHash}.smbackup";
        if (existing is null)
            await storage.PutAsync(objectKey, encryptedContent, "application/octet-stream", cancellationToken);
        var version = new FileVersion {
            BackupFile = file, ContentHash = contentHash, ObjectKey = objectKey,
            PlainSizeBytes = plainSizeBytes, EncryptedSizeBytes = encryptedSizeBytes,
            SourceModifiedAt = sourceModifiedAt.ToUniversalTime(), UploadedAt = now
        };
        db.FileVersions.Add(version);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch { if (existing is null) await storage.DeleteAsync(objectKey, cancellationToken); throw; }
        return (version, existing is not null);
    }

    [GeneratedRegex("^[0-9a-f]{64}$")]
    private static partial Regex Sha256Regex();
}
