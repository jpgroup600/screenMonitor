using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public class SecurityEventService(SmDbContext dbContext, TimeProvider timeProvider)
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase) { "USB_CONNECTED", "USB_DISCONNECTED", "FILE_COPY", "FILE_CREATED", "FILE_MODIFIED", "FILE_DELETED", "FILE_MOVED", "NETWORK_TRANSFER" };

    public async Task<SecurityEvent> RecordAsync(string employeeId, string deviceId, string eventType, string source, string details)
    {
        if (!AllowedTypes.Contains(eventType)) throw new ArgumentException("Unsupported security event type.");
        if (string.IsNullOrWhiteSpace(deviceId) || deviceId.Length > 100) throw new ArgumentException("Invalid device ID.");
        if (source?.Length > 2048) throw new ArgumentException("Security event source is too long.");
        var normalizedDetails = string.IsNullOrWhiteSpace(details) ? "{}" : details;
        if (normalizedDetails.Length > 16 * 1024) throw new ArgumentException("Security event details are too large.");
        try { using var _ = JsonDocument.Parse(normalizedDetails); }
        catch (JsonException) { throw new ArgumentException("Security event details must be valid JSON."); }
        var ownsActiveDevice = await dbContext.Devices.AsNoTracking().AnyAsync(device =>
            device.Id == deviceId && device.EmployeeId == employeeId && device.Status == "Active");
        if (!ownsActiveDevice) throw new UnauthorizedAccessException("The device does not belong to this employee or is blocked.");
        var entry = new SecurityEvent {
            EmployeeId = employeeId, DeviceId = deviceId, EventType = eventType.ToUpperInvariant(),
            Source = source ?? string.Empty, Details = normalizedDetails,
            Severity = eventType.Equals("USB_CONNECTED", StringComparison.OrdinalIgnoreCase)
                || eventType.Equals("NETWORK_TRANSFER", StringComparison.OrdinalIgnoreCase) ? "Warning" : "Info",
            OccurredAt = timeProvider.GetUtcNow().UtcDateTime
        };
        dbContext.SecurityEvents.Add(entry); await dbContext.SaveChangesAsync(); return entry;
    }

    public Task<List<SecurityEvent>> ListAsync(int take = 200) => dbContext.SecurityEvents.AsNoTracking().Include(x => x.Employee)
        .OrderByDescending(x => x.OccurredAt).Take(Math.Clamp(take, 1, 500)).ToListAsync();
}
