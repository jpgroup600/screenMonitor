using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class AdminAuditServiceTests
{
    [Fact]
    public async Task Appended_actions_form_one_verifiable_sequence()
    {
        await using var db = CreateDb();
        var service = new AdminAuditService(db, TimeProvider.System);
        await service.AppendAndSaveAsync("admin-1", "BACKUP_DETAIL_VIEWED", "BackupFile", "file-1", null, new { Path = "work.txt" });
        await service.AppendAndSaveAsync("admin-1", "BACKUP_RESTORE_REQUESTED", "BackupRestoreRequest", "restore-1", null, new { Version = "v1" });

        var entries = await service.ListAsync();
        Assert.Equal(new long[] { 2, 1 }, entries.Select(x => x.Sequence));
        Assert.True(await service.VerifyChainAsync());
    }

    [Fact]
    public async Task Tampering_with_any_action_breaks_the_chain()
    {
        await using var db = CreateDb();
        var service = new AdminAuditService(db, TimeProvider.System);
        await service.AppendAndSaveAsync("admin-1", "BACKUP_DETAIL_VIEWED", "BackupFile", "file-1", null, new { Path = "work.txt" });
        var entry = await db.AdminAuditLogs.SingleAsync();
        entry.TargetId = "other-file";
        await db.SaveChangesAsync();
        Assert.False(await service.VerifyChainAsync());
    }

    private static SmDbContext CreateDb() => new(new DbContextOptionsBuilder<SmDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
