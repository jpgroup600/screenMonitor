using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Dto.Security;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public class DeviceSecurityPolicyService(SmDbContext db, TimeProvider timeProvider)
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
        await AppendAuditAsync(adminId, "DEVICE_SECURITY_POLICY_UPDATED", "Device", deviceId, before, after, policy.UpdatedAt);
        await db.SaveChangesAsync();
        return policy;
    }

    public Task<List<AdminAuditLog>> ListAuditAsync(int take = 200) => db.AdminAuditLogs.AsNoTracking()
        .OrderByDescending(x => x.OccurredAt).Take(Math.Clamp(take, 1, 500)).ToListAsync();

    public async Task<bool> VerifyAuditChainAsync()
    {
        var entries = await db.AdminAuditLogs.AsNoTracking().OrderBy(x => x.Sequence).ToListAsync();
        var previousHash = new string('0', 64);
        foreach (var entry in entries)
        {
            if (entry.PreviousHash != previousHash || entry.EntryHash != ComputeHash(
                previousHash, entry.OccurredAt, entry.AdminId, entry.Action, entry.TargetType,
                entry.TargetId, entry.BeforeJson, entry.AfterJson)) return false;
            previousHash = entry.EntryHash;
        }
        return true;
    }

    private async Task AppendAuditAsync(string adminId, string action, string targetType, string targetId, string before, string after, DateTime occurredAt)
    {
        var previous = await db.AdminAuditLogs.OrderByDescending(x => x.Sequence).Select(x => new { x.Sequence, x.EntryHash }).FirstOrDefaultAsync();
        var previousHash = previous?.EntryHash ?? new string('0', 64);
        var entryHash = ComputeHash(previousHash, occurredAt, adminId, action, targetType, targetId, before, after);
        db.AdminAuditLogs.Add(new AdminAuditLog {
            Sequence = (previous?.Sequence ?? 0) + 1, AdminId = adminId, Action = action, TargetType = targetType, TargetId = targetId,
            BeforeJson = before, AfterJson = after, PreviousHash = previousHash, EntryHash = entryHash, OccurredAt = occurredAt
        });
    }

    private static string ComputeHash(string previousHash, DateTime occurredAt, string adminId, string action, string targetType, string targetId, string before, string after)
    {
        var canonical = string.Join("|", previousHash, occurredAt.ToUniversalTime().ToString("O"), adminId, action, targetType, targetId, before, after);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }

    private static DeviceSecurityPolicy Default(string deviceId) => new() { DeviceId = deviceId };

    private static void Apply(DeviceSecurityPolicy policy, UpdateDeviceSecurityPolicyDto value)
    {
        policy.MonitoringEnabled = value.MonitoringEnabled;
        policy.ScreenshotsEnabled = value.ScreenshotsEnabled;
        policy.ActiveAppTrackingEnabled = value.ActiveAppTrackingEnabled;
        policy.IdleTrackingEnabled = value.IdleTrackingEnabled;
        policy.BackupEnabled = value.BackupEnabled;
        policy.UsbAuditEnabled = value.UsbAuditEnabled;
        policy.NetworkAuditEnabled = value.NetworkAuditEnabled;
        policy.FileChangeAuditEnabled = value.FileChangeAuditEnabled;
        policy.AttendanceRemindersEnabled = value.AttendanceRemindersEnabled;
        policy.RestoreEnabled = value.RestoreEnabled;
    }

    internal static string Snapshot(DeviceSecurityPolicy value) => JsonSerializer.Serialize(new {
        value.MonitoringEnabled, value.ScreenshotsEnabled, value.ActiveAppTrackingEnabled, value.IdleTrackingEnabled,
        value.BackupEnabled, value.UsbAuditEnabled, value.NetworkAuditEnabled, value.FileChangeAuditEnabled,
        value.AttendanceRemindersEnabled, value.RestoreEnabled
    });
}
