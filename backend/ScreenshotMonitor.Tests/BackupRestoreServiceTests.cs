using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class BackupRestoreServiceTests
{
    [Fact]
    public async Task Admin_request_is_delivered_only_to_original_employee_device()
    {
        await using var db = CreateDb(); await Seed(db);
        var service = new BackupRestoreService(db, TimeProvider.System);
        var request = await service.RequestAsync("version-1");
        Assert.NotNull(request);
        Assert.Single(await service.PendingAsync("employee-1", "device-1"));
        Assert.Empty(await service.PendingAsync("employee-1", "other-device"));
        Assert.Empty(await service.PendingAsync("other-employee", "device-1"));
    }

    [Fact]
    public async Task Device_completion_records_safe_result_and_removes_pending_request()
    {
        await using var db = CreateDb(); await Seed(db);
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 30, 1, 0, 0, TimeSpan.Zero));
        var service = new BackupRestoreService(db, clock);
        var request = await service.RequestAsync("version-1");
        clock.Advance(TimeSpan.FromMinutes(1));
        Assert.True(await service.CompleteAsync(request!.Id, "employee-1", "device-1", true, @"C:\Work\file.restored.txt", null));
        Assert.Empty(await service.PendingAsync("employee-1", "device-1"));
        var saved = await db.BackupRestoreRequests.FindAsync(request.Id);
        Assert.Equal("Completed", saved!.Status); Assert.Equal(@"C:\Work\file.restored.txt", saved.ResultPath); Assert.Equal(clock.GetUtcNow().UtcDateTime, saved.CompletedAt);
    }

    [Fact]
    public async Task Duplicate_pending_request_is_reused()
    {
        await using var db = CreateDb(); await Seed(db);
        var service = new BackupRestoreService(db, TimeProvider.System);
        var first = await service.RequestAsync("version-1");
        var second = await service.RequestAsync("version-1");
        Assert.Equal(first!.Id, second!.Id); Assert.Single(db.BackupRestoreRequests);
    }

    private static async Task Seed(SmDbContext db)
    {
        db.Users.Add(new User { Id = "employee-1", FullName = "Employee", Email = "e@example.com", PasswordHash = "hash", Role = "Employee", Designation = "", PhoneNumber = "" });
        db.BackupFiles.Add(new BackupFile { Id = "file-1", EmployeeId = "employee-1", DeviceId = "device-1", OriginalPath = @"C:\Work\file.txt", FirstSeenAt = DateTime.UtcNow, LastSeenAt = DateTime.UtcNow });
        db.FileVersions.Add(new FileVersion { Id = "version-1", BackupFileId = "file-1", ContentHash = new string('a', 64), ObjectKey = "objects/a", PlainSizeBytes = 10, EncryptedSizeBytes = 20, UploadedAt = DateTime.UtcNow, SourceModifiedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }
    private static SmDbContext CreateDb() => new(new DbContextOptionsBuilder<SmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private sealed class FakeTimeProvider(DateTimeOffset now) : TimeProvider { private DateTimeOffset current = now; public override DateTimeOffset GetUtcNow() => current; public void Advance(TimeSpan value) => current += value; }
}
