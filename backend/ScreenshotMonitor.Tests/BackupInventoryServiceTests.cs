using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class BackupInventoryServiceTests
{
    [Fact]
    public async Task Scan_discovers_files_without_creating_upload_work()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        await service.SetRuleAsync("device", @"C:\Work", "Include");
        var run = await service.StartAsync("employee", "device");
        var files = new[] { new InventoryEntry(@"C:\Work\a.txt", 10, 1), new InventoryEntry(@"C:\Work\b.txt", 20, 2) };
        Assert.Equal(2, await service.AddBatchAsync(run.Id, "employee", files));
        Assert.Equal(0, await service.AddBatchAsync(run.Id, "employee", files));
        Assert.Empty(await service.PendingItemsAsync(run.Id, "employee", "device", 10));
        Assert.True(await service.CompleteInventoryAsync(run.Id, "employee"));
        Assert.Equal("PolicyDraft", (await service.ProgressAsync(run.Id))!.Status);
        Assert.All(db.BackupInventoryItems, item => Assert.Equal("Discovered", item.Status));
    }

    [Fact]
    public async Task Policy_must_be_confirmed_before_backup_can_start()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        await service.SetRuleAsync("device", @"C:\Work", "Include");
        var run = await CompletedScan(service);
        Assert.False(await service.StartBackupAsync(run.Id));
        Assert.True(await service.ConfirmPlanAsync(run.Id));
        Assert.Equal("PlanReady", (await db.BackupInventoryRuns.FindAsync(run.Id))!.Status);
        Assert.True(await service.StartBackupAsync(run.Id));
        Assert.Single(await service.PendingItemsAsync(run.Id, "employee", "device", 10));
    }

    [Fact]
    public async Task Most_specific_rule_is_frozen_at_confirmation()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        await service.SetRuleAsync("device", @"C:\Work", "Include");
        await service.SetRuleAsync("device", @"C:\Work\Private", "Exclude");
        var run = await service.StartAsync("employee", "device");
        await service.AddBatchAsync(run.Id, "employee", new[] {
            new InventoryEntry(@"C:\Work\plan.docx", 10, 1), new InventoryEntry(@"C:\Work\Private\secret.txt", 20, 2),
            new InventoryEntry(@"D:\Other\default.txt", 30, 3) });
        await service.CompleteInventoryAsync(run.Id, "employee"); await service.ConfirmPlanAsync(run.Id);
        Assert.Equal("Pending", db.BackupInventoryItems.Single(x => x.Path.EndsWith("plan.docx")).Status);
        Assert.Equal("Excluded", db.BackupInventoryItems.Single(x => x.Path.EndsWith("secret.txt")).Status);
        Assert.Equal("Excluded", db.BackupInventoryItems.Single(x => x.Path.EndsWith("default.txt")).Status);

        await service.SetRuleAsync("device", @"C:\Work", "Exclude");
        Assert.Equal("Pending", db.BackupInventoryItems.Single(x => x.Path.EndsWith("plan.docx")).Status);
        Assert.False(await service.ConfirmPlanAsync(run.Id));
    }

    [Fact]
    public async Task Unchanged_files_never_enter_the_confirmed_plan()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        await service.SetRuleAsync("device", @"C:\Work", "Include");
        var run = await service.StartAsync("employee", "device");
        await service.AddBatchAsync(run.Id, "employee", new[] {
            new InventoryEntry(@"C:\Work\same.txt", 1, 1, false), new InventoryEntry(@"C:\Work\changed.txt", 2, 2, true) });
        await service.CompleteInventoryAsync(run.Id, "employee"); await service.ConfirmPlanAsync(run.Id); await service.StartBackupAsync(run.Id);
        Assert.Single(await service.PendingItemsAsync(run.Id, "employee", "device", 10));
        Assert.Equal("Unchanged", db.BackupInventoryItems.Single(x => x.Path.EndsWith("same.txt")).Status);
    }

    [Fact]
    public async Task Folder_totals_and_boundaries_are_available_for_policy_editing()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        var run = await service.StartAsync("employee", "device");
        await service.AddBatchAsync(run.Id, "employee", new[] {
            new InventoryEntry(@"C:\Work\inside.txt", 10, 1), new InventoryEntry(@"C:\Work\Child\deep.txt", 20, 2),
            new InventoryEntry(@"C:\Workspace\outside.txt", 30, 3) });
        await service.CompleteInventoryAsync(run.Id, "employee");
        var work = Assert.Single(await service.ListFoldersAsync(run.Id, "Work"), x => x.Path == @"C:\Work");
        Assert.Equal(2, work.FileCount); Assert.Equal(30, work.SizeBytes);
        Assert.Equal(2, (await service.ListItemsAsync(run.Id, null, null, folderPath: @"C:\Work")).Count);
    }

    [Fact]
    public async Task Stale_scan_is_abandoned_but_policy_draft_is_retained()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var clock = new Clock(new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero));
        var service = new BackupInventoryService(db, clock);
        var stale = await service.StartAsync("employee", "device");
        clock.Advance(BackupInventoryService.StaleScanningTimeout + TimeSpan.FromMinutes(1));
        Assert.Null(await service.ActiveRunAsync("employee", "device"));
        Assert.Equal("Abandoned", (await db.BackupInventoryRuns.FindAsync(stale.Id))!.Status);
        var ready = await CompletedScan(service); clock.Advance(TimeSpan.FromDays(1));
        Assert.Equal(ready.Id, (await service.ActiveRunAsync("employee", "device"))!.Id);
    }

    [Fact]
    public async Task Backup_results_complete_the_frozen_plan()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        await service.SetRuleAsync("device", @"C:\Work", "Include");
        var run = await CompletedScan(service); await service.ConfirmPlanAsync(run.Id); await service.StartBackupAsync(run.Id);
        var item = Assert.Single(await service.PendingItemsAsync(run.Id, "employee", "device", 10));
        Assert.True(await service.RecordResultAsync(item.Id, "employee", "device", true, null));
        Assert.Equal("Completed", (await db.BackupInventoryRuns.FindAsync(run.Id))!.Status);
        Assert.NotNull((await service.ProgressAsync(run.Id))!.LastBackupActivityAt);
    }

    [Fact]
    public async Task Bulk_folder_rules_are_stored_once_per_path()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        Assert.Equal(2, await service.SetRulesAsync("device", new[] { @"C:\One", @"C:\Two", @"C:\One" }, "Include"));
        Assert.Equal(2, await db.BackupPathRules.CountAsync());
    }

    [Fact]
    public async Task Removing_a_draft_rule_does_not_touch_discovered_files()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        var rule = await service.SetRuleAsync("device", @"C:\Work", "Include");
        var run = await CompletedScan(service);
        Assert.NotNull(await service.RemoveRuleAsync(rule.Id));
        Assert.Equal("Discovered", Assert.Single(db.BackupInventoryItems).Status);
        Assert.Null(await service.RemoveRuleAsync("missing"));
    }

    [Fact]
    public async Task Folder_search_is_paginated_after_sorting()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        var run = await service.StartAsync("employee", "device");
        await service.AddBatchAsync(run.Id, "employee", Enumerable.Range(0, 4).Select(i => new InventoryEntry($@"C:\Work\Folder{i}\file.txt", 1, i)));
        var page = await service.ListFoldersAsync(run.Id, "Folder", 1, 2);
        Assert.Equal(new[] { @"C:\Work\Folder1", @"C:\Work\Folder2" }, page.Select(x => x.Path));
    }

    [Fact]
    public async Task Scan_progress_is_monotonic()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        var run = await service.StartAsync("employee", "device");
        await service.UpdateProgressAsync(run.Id, "employee", 50, 500, 3, 1, @"C:\One");
        await service.UpdateProgressAsync(run.Id, "employee", 40, 400, 2, 0, @"C:\Two");
        var progress = await service.ProgressAsync(run.Id);
        Assert.Equal(50, progress!.DiscoveredFiles); Assert.Equal(500, progress.DiscoveredBytes); Assert.Equal(@"C:\Two", progress.CurrentPath);
    }

    [Fact]
    public async Task Recent_scanning_run_remains_active()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var clock = new Clock(new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero));
        var service = new BackupInventoryService(db, clock); var run = await service.StartAsync("employee", "device");
        clock.Advance(TimeSpan.FromMinutes(30)); Assert.Equal(run.Id, (await service.ActiveRunAsync("employee", "device"))!.Id);
    }

    [Fact]
    public async Task Empty_include_policy_confirms_as_an_empty_plan()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System); var run = await CompletedScan(service);
        Assert.True(await service.ConfirmPlanAsync(run.Id)); Assert.True(await service.StartBackupAsync(run.Id));
        Assert.Equal("Completed", (await db.BackupInventoryRuns.FindAsync(run.Id))!.Status);
    }

    [Fact]
    public async Task Invalid_actions_and_empty_paths_are_rejected()
    {
        await using var db = Db(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new BackupInventoryService(db, TimeProvider.System);
        await Assert.ThrowsAsync<ArgumentException>(() => service.SetRuleAsync("device", " ", "Include"));
        await Assert.ThrowsAsync<ArgumentException>(() => service.SetRuleAsync("device", @"C:\Work", "Maybe"));
    }

    private static async Task<BackupInventoryRun> CompletedScan(BackupInventoryService service)
    {
        var run = await service.StartAsync("employee", "device");
        await service.AddBatchAsync(run.Id, "employee", new[] { new InventoryEntry(@"C:\Work\plan.docx", 10, 1) });
        await service.CompleteInventoryAsync(run.Id, "employee"); return run;
    }
    private static User Employee() => new() { Id = "employee", FullName = "Employee", Email = "e@example.com", PasswordHash = "hash", Role = "Employee", Designation = "", PhoneNumber = "" };
    private static SmDbContext Db() => new(new DbContextOptionsBuilder<SmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private sealed class Clock(DateTimeOffset now) : TimeProvider { private DateTimeOffset value = now; public override DateTimeOffset GetUtcNow() => value; public void Advance(TimeSpan amount) => value += amount; }
}
