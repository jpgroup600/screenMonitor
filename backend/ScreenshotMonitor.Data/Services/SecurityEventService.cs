using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public class SecurityEventService(SmDbContext dbContext, TimeProvider timeProvider)
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase) { "USB_CONNECTED", "USB_DISCONNECTED", "FILE_COPY", "NETWORK_TRANSFER" };

    public async Task<SecurityEvent> RecordAsync(string employeeId, string deviceId, string eventType, string source, string details)
    {
        if (!AllowedTypes.Contains(eventType)) throw new ArgumentException("Unsupported security event type.");
        var entry = new SecurityEvent {
            EmployeeId = employeeId, DeviceId = deviceId, EventType = eventType.ToUpperInvariant(),
            Source = source, Details = string.IsNullOrWhiteSpace(details) ? "{}" : details,
            Severity = eventType.Equals("USB_CONNECTED", StringComparison.OrdinalIgnoreCase) ? "Warning" : "Info",
            OccurredAt = timeProvider.GetUtcNow().UtcDateTime
        };
        dbContext.SecurityEvents.Add(entry); await dbContext.SaveChangesAsync(); return entry;
    }

    public Task<List<SecurityEvent>> ListAsync(int take = 200) => dbContext.SecurityEvents.AsNoTracking().Include(x => x.Employee)
        .OrderByDescending(x => x.OccurredAt).Take(Math.Clamp(take, 1, 500)).ToListAsync();
}
