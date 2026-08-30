using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public class DeviceService(SmDbContext dbContext, TimeProvider timeProvider)
{
    public async Task<Device> HeartbeatAsync(string employeeId, string deviceId, string name, string operatingSystem,
        string? agentVersion = null, string? agentMode = null, string? monitoringState = null, int pendingQueueItems = 0)
    {
        if (string.IsNullOrWhiteSpace(deviceId)) throw new ArgumentException("DeviceId is required.");
        if (pendingQueueItems < 0) throw new ArgumentException("Pending queue count cannot be negative.");
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var device = await dbContext.Devices.FindAsync(deviceId);
        if (device is null)
        {
            device = new Device { Id = deviceId, EmployeeId = employeeId, Name = name, OperatingSystem = operatingSystem, RegisteredAt = now, LastSeenAt = now };
            dbContext.Devices.Add(device);
        }
        else
        {
            if (device.EmployeeId != employeeId) throw new UnauthorizedAccessException("Device belongs to another employee.");
            if (device.Status == "Blocked") throw new UnauthorizedAccessException("Device is blocked.");
            device.Name = name;
            device.OperatingSystem = operatingSystem;
            device.LastSeenAt = now;
        }
        device.AgentVersion = Limit(agentVersion, 50);
        device.AgentMode = Limit(agentMode, 30, "UserSession");
        device.MonitoringState = Limit(monitoringState, 30, "Unknown");
        device.PendingQueueItems = Math.Min(pendingQueueItems, 1_000_000);
        await dbContext.SaveChangesAsync();
        return device;
    }

    private static string Limit(string? value, int maxLength, string fallback = "") =>
        string.IsNullOrWhiteSpace(value) ? fallback : string.Concat(value.Trim().Take(maxLength));

    public Task<List<Device>> ListAsync() => dbContext.Devices.AsNoTracking().Include(x => x.Employee).OrderByDescending(x => x.LastSeenAt).ToListAsync();

    public async Task<bool> SetStatusAsync(string deviceId, string status)
    {
        if (status is not ("Active" or "Blocked")) throw new ArgumentException("Status must be Active or Blocked.");
        var device = await dbContext.Devices.FindAsync(deviceId);
        if (device is null) return false;
        device.Status = status;
        await dbContext.SaveChangesAsync();
        return true;
    }
}
