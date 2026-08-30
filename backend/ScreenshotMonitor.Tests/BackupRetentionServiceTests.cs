using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class BackupRetentionServiceTests
{
    [Fact]
    public async Task Deletes_expired_versions_but_keeps_the_newest_version()
    {
        await using var db = CreateDb();
        var now = new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero);
        AddFile(db, "file-1", Version("old", "old-key", now.AddDays(-100), 10), Version("new", "new-key", now, 10));
        await db.SaveChangesAsync();
        var storage = new FakeStorage();

        var result = await new BackupRetentionService(db, storage, new FakeTimeProvider(now)).ApplyAsync("device-1", 30, 10_000_000, 20);

        Assert.Equal(1, result.DeletedVersions);
        Assert.Equal("new", Assert.Single(db.FileVersions).Id);
        Assert.Equal(new[] { "old-key" }, storage.DeletedKeys);
        Assert.Empty(db.StorageDeletionJobs);
    }

    [Fact]
    public async Task Shared_object_is_not_deleted_while_another_version_references_it()
    {
        await using var db = CreateDb();
        var now = new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero);
        AddFile(db, "file-1", Version("old", "shared-key", now.AddDays(-100), 10));
        AddFile(db, "file-2", Version("current", "shared-key", now, 10));
        await db.SaveChangesAsync();
        var storage = new FakeStorage();

        await new BackupRetentionService(db, storage, new FakeTimeProvider(now)).ApplyAsync("device-1", 30, 10_000_000, 20);

        Assert.Empty(storage.DeletedKeys);
        Assert.Equal("current", Assert.Single(db.FileVersions).Id);
        Assert.Empty(db.StorageDeletionJobs);
    }

    [Fact]
    public async Task Pending_restore_protects_a_version_from_retention_and_quota()
    {
        await using var db = CreateDb();
        var now = new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero);
        var protectedVersion = Version("protected", "protected-key", now.AddDays(-100), 2_000_000);
        protectedVersion.RestoreRequests.Add(new BackupRestoreRequest { Id = "restore-1", EmployeeId = "employee-1", DeviceId = "device-1", OriginalPath = "file", Status = "Pending" });
        AddFile(db, "file-1", protectedVersion);
        await db.SaveChangesAsync();
        var storage = new FakeStorage();

        var result = await new BackupRetentionService(db, storage, new FakeTimeProvider(now)).ApplyAsync("device-1", 1, 1_048_576, 1);

        Assert.Equal(0, result.DeletedVersions);
        Assert.Single(db.FileVersions);
        Assert.Empty(storage.DeletedKeys);
    }

    [Fact]
    public async Task Failed_object_deletion_stays_in_a_durable_retry_queue()
    {
        await using var db = CreateDb();
        var now = new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero);
        AddFile(db, "file-1", Version("old", "old-key", now.AddDays(-100), 10));
        await db.SaveChangesAsync();
        var storage = new FakeStorage { FailDelete = true };

        var result = await new BackupRetentionService(db, storage, new FakeTimeProvider(now)).ApplyAsync("device-1", 30, 10_000_000, 20);

        Assert.Equal(1, result.FailedObjects);
        var job = Assert.Single(db.StorageDeletionJobs);
        Assert.Equal(1, job.Attempts);
        Assert.True(job.NextAttemptAt > now.UtcDateTime);
    }

    private static void AddFile(SmDbContext db, string id, params FileVersion[] versions)
    {
        var file = new BackupFile { Id = id, EmployeeId = "employee-1", DeviceId = "device-1", OriginalPath = id };
        foreach (var version in versions) file.Versions.Add(version);
        db.BackupFiles.Add(file);
    }

    private static FileVersion Version(string id, string key, DateTimeOffset uploadedAt, long bytes) =>
        new() { Id = id, ContentHash = new string(id[0], 64), ObjectKey = key, PlainSizeBytes = bytes, EncryptedSizeBytes = bytes, SourceModifiedAt = uploadedAt.UtcDateTime, UploadedAt = uploadedAt.UtcDateTime };

    private static SmDbContext CreateDb() => new(new DbContextOptionsBuilder<SmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private sealed class FakeStorage : IBackupObjectStorage
    {
        public bool FailDelete { get; init; }
        public List<string> DeletedKeys { get; } = [];
        public Task PutAsync(string objectKey, Stream encryptedContent, string contentType, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<Stream> OpenReadAsync(string objectKey, CancellationToken cancellationToken = default) => Task.FromResult<Stream>(new MemoryStream());
        public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default)
        {
            if (FailDelete) throw new IOException("storage unavailable");
            DeletedKeys.Add(objectKey);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
