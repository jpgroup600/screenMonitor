using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class BackupServiceTests
{
    [Fact]
    public async Task Upload_stores_encrypted_object_then_records_version()
    {
        await using var db = CreateDb(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var storage = new FakeStorage(); var service = new BackupService(db, storage, TimeProvider.System);
        var encrypted = new MemoryStream([1, 2, 3]);

        var (version, deduplicated) = await service.UploadAsync("employee-1", "device-1", @"C:\Work\plan.docx", new string('a', 64), 20, DateTime.UtcNow, encrypted, 3);

        Assert.False(deduplicated); Assert.Single(db.BackupFiles); Assert.Single(db.FileVersions);
        Assert.Equal(version.ObjectKey, storage.StoredKey); Assert.Equal(new byte[] { 1, 2, 3 }, storage.Bytes);
    }

    [Fact]
    public async Task Upload_deduplicates_same_employee_content_without_second_object()
    {
        await using var db = CreateDb(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var storage = new FakeStorage(); var service = new BackupService(db, storage, TimeProvider.System);
        var hash = new string('b', 64);
        await service.UploadAsync("employee-1", "device-1", @"C:\Work\a.docx", hash, 10, DateTime.UtcNow, new MemoryStream([1]), 1);
        var (_, deduplicated) = await service.UploadAsync("employee-1", "device-1", @"C:\Work\copy.docx", hash, 10, DateTime.UtcNow, new MemoryStream([1]), 1);

        Assert.True(deduplicated); Assert.Equal(1, storage.PutCount); Assert.Equal(2, db.BackupFiles.Count()); Assert.Equal(2, db.FileVersions.Count());
    }

    [Fact]
    public async Task Upload_rejects_invalid_hash_before_storage()
    {
        await using var db = CreateDb(); var storage = new FakeStorage(); var service = new BackupService(db, storage, TimeProvider.System);
        await Assert.ThrowsAsync<ArgumentException>(() => service.UploadAsync("employee-1", "device-1", "file", "bad", 1, DateTime.UtcNow, new MemoryStream([1]), 1));
        Assert.Equal(0, storage.PutCount);
    }

    private static User Employee() => new() { Id = "employee-1", FullName = "Employee", Email = "e@example.com", PasswordHash = "hash", Role = "Employee", Designation = "", PhoneNumber = "" };
    private static SmDbContext CreateDb() => new(new DbContextOptionsBuilder<SmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private sealed class FakeStorage : IBackupObjectStorage
    {
        public int PutCount { get; private set; } public string? StoredKey { get; private set; } public byte[] Bytes { get; private set; } = [];
        public async Task PutAsync(string objectKey, Stream encryptedContent, string contentType, CancellationToken cancellationToken = default) { PutCount++; StoredKey = objectKey; using var memory = new MemoryStream(); await encryptedContent.CopyToAsync(memory, cancellationToken); Bytes = memory.ToArray(); }
        public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
