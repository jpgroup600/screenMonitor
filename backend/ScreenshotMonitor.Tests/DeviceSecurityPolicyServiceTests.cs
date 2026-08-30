using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Dto.Security;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class DeviceSecurityPolicyServiceTests
{
    [Fact]
    public async Task New_device_uses_safe_enabled_defaults_without_creating_mutable_policy()
    {
        await using var db = CreateDb(); await SeedAsync(db);
        var policy = await CreateService(db, TimeProvider.System).GetForEmployeeAsync("employee-1", "device-1");
        Assert.True(policy.MonitoringEnabled); Assert.True(policy.BackupEnabled); Assert.True(policy.UsbAuditEnabled);
        Assert.Empty(db.DeviceSecurityPolicies);
    }

    [Fact]
    public async Task Employee_cannot_read_another_employees_device_policy()
    {
        await using var db = CreateDb(); await SeedAsync(db);
        var service = CreateService(db, TimeProvider.System);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.GetForEmployeeAsync("employee-2", "device-1"));
    }

    [Fact]
    public async Task Admin_can_toggle_modules_independently_and_change_is_audited()
    {
        await using var db = CreateDb(); await SeedAsync(db);
        var now = new DateTimeOffset(2026, 8, 31, 4, 0, 0, TimeSpan.Zero);
        var service = CreateService(db, new FakeTimeProvider(now));
        var update = Update(monitoring: true, screenshots: false, backup: false, usb: true, network: false);

        var policy = await service.UpdateAsync("admin-1", "device-1", update);

        Assert.True(policy.MonitoringEnabled); Assert.False(policy.ScreenshotsEnabled); Assert.False(policy.BackupEnabled);
        Assert.True(policy.UsbAuditEnabled); Assert.False(policy.NetworkAuditEnabled);
        Assert.True(policy.ResourceThrottlingEnabled); Assert.True(policy.PauseBackupOnBattery); Assert.True(policy.PauseBackupOnMeteredNetwork);
        var audit = Assert.Single(db.AdminAuditLogs);
        Assert.Equal("admin-1", audit.AdminId); Assert.Equal("DEVICE_SECURITY_POLICY_UPDATED", audit.Action);
        Assert.Equal(new string('0', 64), audit.PreviousHash); Assert.Equal(64, audit.EntryHash.Length);
        Assert.Contains("\"ScreenshotsEnabled\":false", audit.AfterJson);
    }

    [Fact]
    public async Task Audit_entries_form_a_tamper_evident_hash_chain()
    {
        await using var db = CreateDb(); await SeedAsync(db);
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 31, 4, 0, 0, TimeSpan.Zero));
        var service = CreateService(db, clock);
        await service.UpdateAsync("admin-1", "device-1", Update(backup: false));
        clock.Advance(TimeSpan.FromMinutes(1));
        await service.UpdateAsync("admin-1", "device-1", Update(backup: true));

        var entries = await db.AdminAuditLogs.OrderBy(x => x.OccurredAt).ToListAsync();
        Assert.Equal(2, entries.Count); Assert.Equal(entries[0].EntryHash, entries[1].PreviousHash);
        Assert.NotEqual(entries[0].EntryHash, entries[1].EntryHash);
        Assert.True(await service.VerifyAuditChainAsync());

        entries[0].AfterJson = "{\"tampered\":true}"; await db.SaveChangesAsync();
        Assert.False(await service.VerifyAuditChainAsync());
    }

    [Fact]
    public async Task Invalid_retention_limits_are_rejected_before_policy_is_changed()
    {
        await using var db = CreateDb(); await SeedAsync(db);
        var service = CreateService(db, TimeProvider.System);
        var invalid = new UpdateDeviceSecurityPolicyDto(true, true, true, true, true, true, true, true, true, true,
            true, true, 0, 50L * 1024 * 1024 * 1024, 20, true, true, true, 2, 10L * 1024 * 1024 * 1024);
        await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateAsync("admin-1", "device-1", invalid));
        Assert.Empty(db.DeviceSecurityPolicies);
        Assert.Empty(db.AdminAuditLogs);
    }

    private static UpdateDeviceSecurityPolicyDto Update(bool monitoring = true, bool screenshots = true, bool backup = true, bool usb = true, bool network = true) =>
        new(monitoring, screenshots, true, true, backup, usb, true, network, true, true, true, false, 90, 50L * 1024 * 1024 * 1024, 20,
            true, true, true, 2, 10L * 1024 * 1024 * 1024);

    [Fact]
    public async Task Invalid_resource_limits_are_rejected_and_audited_values_are_complete()
    {
        await using var db = CreateDb(); await SeedAsync(db);
        var service = CreateService(db, TimeProvider.System);
        var invalid = Update() with { ScanThrottleMilliseconds = 1001 };
        await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateAsync("admin-1", "device-1", invalid));
        Assert.Empty(db.DeviceSecurityPolicies);
        var valid = Update() with { ResourceThrottlingEnabled = false, DailyUploadLimitBytes = 1024 * 1024 };
        await service.UpdateAsync("admin-1", "device-1", valid);
        var audit = Assert.Single(db.AdminAuditLogs);
        Assert.Contains("\"ResourceThrottlingEnabled\":false", audit.AfterJson);
        Assert.Contains("\"PauseBackupOnMeteredNetwork\":true", audit.AfterJson);
        Assert.Contains("\"DailyUploadLimitBytes\":1048576", audit.AfterJson);
    }

    [Fact]
    public async Task Legacy_admin_payload_defaults_metered_network_pause_to_enabled()
    {
        await using var db = CreateDb(); await SeedAsync(db);
        var policy = await CreateService(db, TimeProvider.System).UpdateAsync(
            "admin-1", "device-1", Update() with { PauseBackupOnMeteredNetwork = null });
        Assert.True(policy.PauseBackupOnMeteredNetwork);
    }

    private static async Task SeedAsync(SmDbContext db)
    {
        db.Users.AddRange(
            new User { Id="employee-1", FullName="Employee", Email="e@example.com", PasswordHash="hash", Role="Employee", Designation="", PhoneNumber="" },
            new User { Id="admin-1", FullName="Admin", Email="a@example.com", PasswordHash="hash", Role="Admin", Designation="", PhoneNumber="" });
        db.Devices.Add(new Device { Id="device-1", EmployeeId="employee-1", Name="PC", OperatingSystem="Windows" });
        await db.SaveChangesAsync();
    }

    private static SmDbContext CreateDb() => new(new DbContextOptionsBuilder<SmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static DeviceSecurityPolicyService CreateService(SmDbContext db, TimeProvider clock) =>
        new(db, clock, new AdminAuditService(db, clock));
    private sealed class FakeTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset current = now;
        public override DateTimeOffset GetUtcNow() => current;
        public void Advance(TimeSpan value) => current += value;
    }
}
