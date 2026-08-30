using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class BackupInventoryServiceTests
{
    [Fact]
    public async Task Inventory_is_registered_before_backup_and_batches_are_idempotent()
    {
        await using var db = CreateDb(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        var run = await service.StartAsync("employee-1", "device-1");
        var entries = new[] { new InventoryEntry(@"C:\Work\a.txt", 10, 1), new InventoryEntry(@"C:\Work\b.txt", 20, 2) };
        Assert.Equal(2, await service.AddBatchAsync(run.Id, "employee-1", entries));
        Assert.Equal(0, await service.AddBatchAsync(run.Id, "employee-1", entries));
        Assert.True(await service.CompleteInventoryAsync(run.Id, "employee-1"));
        var progress = await service.ProgressAsync(run.Id);
        Assert.Equal("InventoryReady", progress!.Status); Assert.Equal(2, progress.Total); Assert.Equal(2, progress.Pending);
    }

    [Fact]
    public async Task Most_specific_path_rule_wins_and_default_is_included()
    {
        await using var db = CreateDb(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        await service.SetRuleAsync("device-1", @"C:\Work", "Exclude");
        await service.SetRuleAsync("device-1", @"C:\Work\Company", "Include");
        var run = await service.StartAsync("employee-1", "device-1");
        await service.AddBatchAsync(run.Id, "employee-1", new[] {
            new InventoryEntry(@"C:\Work\private.txt", 1, 1),
            new InventoryEntry(@"C:\Work\Company\plan.docx", 2, 2),
            new InventoryEntry(@"D:\Other\default.txt", 3, 3) });
        await service.CompleteInventoryAsync(run.Id, "employee-1");
        var rows = await db.BackupInventoryItems.OrderBy(x => x.Path).ToListAsync();
        Assert.Equal("Pending", rows.Single(x => x.Path.Contains("Company")).Status);
        Assert.Equal("Excluded", rows.Single(x => x.Path.Contains("private")).Status);
        Assert.Equal("Pending", rows.Single(x => x.Path.Contains("default")).Status);
        Assert.True(await service.StartBackupAsync(run.Id));
        Assert.Equal("BackingUp", (await db.BackupInventoryRuns.FindAsync(run.Id))!.Status);
        var pending = await service.PendingItemsAsync(run.Id, "employee-1", "device-1", 10);
        Assert.Equal(2, pending.Count);
        foreach (var item in pending) Assert.True(await service.RecordResultAsync(item.Id, "employee-1", "device-1", true, null));
        Assert.Equal("Completed", (await db.BackupInventoryRuns.FindAsync(run.Id))!.Status);
    }

    [Fact]
    public async Task Changing_rules_does_not_reset_terminal_backup_results()
    {
        await using var db = CreateDb(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        var run = await service.StartAsync("employee-1", "device-1");
        await service.AddBatchAsync(run.Id, "employee-1", new[] {
            new InventoryEntry(@"C:\Work\done.txt", 1, 1),
            new InventoryEntry(@"C:\Work\waiting.txt", 2, 2) });
        await service.CompleteInventoryAsync(run.Id, "employee-1");
        Assert.True(await service.StartBackupAsync(run.Id));
        var done = (await service.PendingItemsAsync(run.Id, "employee-1", "device-1", 1)).Single();
        Assert.True(await service.RecordResultAsync(done.Id, "employee-1", "device-1", true, null));

        await service.SetRuleAsync("device-1", @"C:\Work", "Exclude");

        var rows = await db.BackupInventoryItems.OrderBy(x => x.Path).ToListAsync();
        Assert.Equal("BackedUp", rows.Single(x => x.Id == done.Id).Status);
        Assert.Equal("Excluded", rows.Single(x => x.Id != done.Id).Status);
    }

    [Fact]
    public async Task Bulk_rules_are_applied_to_all_selected_paths_in_one_operation()
    {
        await using var db = CreateDb(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        var run = await service.StartAsync("employee-1", "device-1");
        await service.AddBatchAsync(run.Id, "employee-1", new[] {
            new InventoryEntry(@"C:\Work\a.txt", 1, 1),
            new InventoryEntry(@"C:\Work\b.txt", 2, 2),
            new InventoryEntry(@"C:\Work\c.txt", 3, 3) });
        await service.CompleteInventoryAsync(run.Id, "employee-1");

        Assert.Equal(2, await service.SetRulesAsync("device-1", new[] { @"C:\Work\a.txt", @"C:\Work\b.txt" }, "Exclude"));

        var rows = await db.BackupInventoryItems.OrderBy(x => x.Path).ToListAsync();
        Assert.Equal(new[] { "Excluded", "Excluded", "Pending" }, rows.Select(x => x.Status));
        Assert.Equal(2, await db.BackupPathRules.CountAsync());
    }

    [Fact]
    public async Task Unchanged_files_are_visible_but_never_queued_for_upload()
    {
        await using var db = CreateDb(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        var run = await service.StartAsync("employee-1", "device-1");
        await service.AddBatchAsync(run.Id, "employee-1", new[] {
            new InventoryEntry(@"C:\Work\same.txt", 1, 1, false),
            new InventoryEntry(@"C:\Work\changed.txt", 2, 2, true) });
        await service.CompleteInventoryAsync(run.Id, "employee-1");
        var progress = await service.ProgressAsync(run.Id);
        Assert.Equal(1, progress!.Unchanged); Assert.Equal(1, progress.Pending);
        Assert.True(await service.StartBackupAsync(run.Id));
        var pending = await service.PendingItemsAsync(run.Id, "employee-1", "device-1", 10);
        Assert.Single(pending); Assert.EndsWith("changed.txt", pending[0].Path);
    }

    private static User Employee() => new() { Id = "employee-1", FullName = "Employee", Email = "e@example.com", PasswordHash = "hash", Role = "Employee", Designation = "", PhoneNumber = "" };
    private static SmDbContext CreateDb() => new(new DbContextOptionsBuilder<SmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
