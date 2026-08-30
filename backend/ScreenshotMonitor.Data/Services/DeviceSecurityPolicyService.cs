using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Dto.Security;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public class DeviceSecurityPolicyService(SmDbContext db, TimeProvider timeProvider, AdminAuditService audit)
{
    public async Task<DeviceSecurityPolicy> GetForEmployeeAsync(string employeeId, string deviceId)
    {
        var device = await db.Devices.AsNoTracking().FirstOrDefaultAsync(x => x.Id == deviceId)
            ?? throw new KeyNotFoundException("Device was not found.");
        if (device.EmployeeId != employeeId) throw new UnauthorizedAccessException("Device does not belong to employee.");
        return await db.DeviceSecurityPolicies.AsNoTracking().FirstOrDefaultAsync(x => x.DeviceId == deviceId)
            ?? Default(deviceId);
    }

    public async Task<DeviceSecurityPolicy> GetForAdminAsync(string deviceId)
    {
        if (!await db.Devices.AsNoTracking().AnyAsync(x => x.Id == deviceId))
            throw new KeyNotFoundException("Device was not found.");
        return await db.DeviceSecurityPolicies.AsNoTracking().FirstOrDefaultAsync(x => x.DeviceId == deviceId)
            ?? Default(deviceId);
    }

    public async Task<DeviceSecurityPolicy> UpdateAsync(string adminId, string deviceId, UpdateDeviceSecurityPolicyDto update)
    {
        Validate(update);
        if (!await db.Devices.AnyAsync(x => x.Id == deviceId)) throw new KeyNotFoundException("Device was not found.");
        var policy = await db.DeviceSecurityPolicies.FirstOrDefaultAsync(x => x.DeviceId == deviceId);
        var before = Snapshot(policy ?? Default(deviceId));
        if (policy is null)
        {
            policy = Default(deviceId);
            db.DeviceSecurityPolicies.Add(policy);
        }
        Apply(policy, update);
        policy.UpdatedByAdminId = adminId;
        policy.UpdatedAt = timeProvider.GetUtcNow().UtcDateTime;
        var after = Snapshot(policy);
        await audit.AppendAsync(adminId, "DEVICE_SECURITY_POLICY_UPDATED", "Device", deviceId, before, after);
        await db.SaveChangesAsync();
        return policy;
    }

    public Task<List<AdminAuditLog>> ListAuditAsync(int take = 200) => audit.ListAsync(take);

    public Task<bool> VerifyAuditChainAsync() => audit.VerifyChainAsync();

    private static DeviceSecurityPolicy Default(string deviceId) => new() { DeviceId = deviceId };

    private static void Apply(DeviceSecurityPolicy policy, UpdateDeviceSecurityPolicyDto value)
    {
        policy.MonitoringEnabled = value.MonitoringEnabled;
        policy.ScreenshotsEnabled = value.ScreenshotsEnabled;
        policy.ActiveAppTrackingEnabled = value.ActiveAppTrackingEnabled;
        policy.IdleTrackingEnabled = value.IdleTrackingEnabled;
        policy.BackupEnabled = value.BackupEnabled;
        policy.UsbAuditEnabled = value.UsbAuditEnabled;
        policy.UsbFileCopyAuditEnabled = value.UsbFileCopyAuditEnabled;
        policy.NetworkAuditEnabled = value.NetworkAuditEnabled;
        policy.FileChangeAuditEnabled = value.FileChangeAuditEnabled;
        policy.AttendanceRemindersEnabled = value.AttendanceRemindersEnabled;
        policy.RestoreEnabled = value.RestoreEnabled;
        policy.RetentionEnabled = value.RetentionEnabled;
        policy.RetentionDays = value.RetentionDays;
        policy.MaxBackupBytes = value.MaxBackupBytes;
        policy.MaxVersionsPerFile = value.MaxVersionsPerFile;
        policy.ResourceThrottlingEnabled = value.ResourceThrottlingEnabled;
        policy.PauseBackupOnBattery = value.PauseBackupOnBattery;
        policy.ScanThrottleMilliseconds = value.ScanThrottleMilliseconds;
        policy.DailyUploadLimitBytes = value.DailyUploadLimitBytes;
    }

    private static void Validate(UpdateDeviceSecurityPolicyDto value)
    {
        if (value.RetentionDays is < 1 or > 3650) throw new ArgumentException("RetentionDays must be between 1 and 3650.");
        if (value.MaxBackupBytes is < 1024 * 1024 or > 10L * 1024 * 1024 * 1024 * 1024)
            throw new ArgumentException("MaxBackupBytes must be between 1 MB and 10 TB.");
        if (value.MaxVersionsPerFile is < 1 or > 1000)
            throw new ArgumentException("MaxVersionsPerFile must be between 1 and 1000.");
        if (value.ScanThrottleMilliseconds is < 0 or > 1000)
            throw new ArgumentException("ScanThrottleMilliseconds must be between 0 and 1000.");
        if (value.DailyUploadLimitBytes is < 1024 * 1024 or > 10L * 1024 * 1024 * 1024 * 1024)
            throw new ArgumentException("DailyUploadLimitBytes must be between 1 MB and 10 TB.");
    }

    internal static string Snapshot(DeviceSecurityPolicy value) => JsonSerializer.Serialize(new {
        value.MonitoringEnabled, value.ScreenshotsEnabled, value.ActiveAppTrackingEnabled, value.IdleTrackingEnabled,
        value.BackupEnabled, value.UsbAuditEnabled, value.UsbFileCopyAuditEnabled, value.NetworkAuditEnabled, value.FileChangeAuditEnabled,
        value.AttendanceRemindersEnabled, value.RestoreEnabled, value.RetentionEnabled,
        value.RetentionDays, value.MaxBackupBytes, value.MaxVersionsPerFile,
        value.ResourceThrottlingEnabled, value.PauseBackupOnBattery,
        value.ScanThrottleMilliseconds, value.DailyUploadLimitBytes
    });
}
