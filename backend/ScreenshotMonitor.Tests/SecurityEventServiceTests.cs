using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class SecurityEventServiceTests
{
    [Fact]
    public async Task Records_usb_connection_with_warning_severity()
    {
        await using var db = CreateDb(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new SecurityEventService(db, TimeProvider.System);
        var entry = await service.RecordAsync("employee-1", "device-1", "USB_CONNECTED", "E:\\", "{}");
        Assert.Equal("Warning", entry.Severity); Assert.Equal("USB_CONNECTED", entry.EventType); Assert.Single(db.SecurityEvents);
    }
    [Fact]
    public async Task Rejects_unknown_event_types()
    {
        await using var db = CreateDb(); var service = new SecurityEventService(db, TimeProvider.System);
        await Assert.ThrowsAsync<ArgumentException>(() => service.RecordAsync("employee-1", "device-1", "UNKNOWN", "", "{}"));
    }
    private static User Employee() => new() { Id="employee-1", FullName="Employee", Email="e@example.com", PasswordHash="hash", Role="Employee", Designation="", PhoneNumber="" };
    private static SmDbContext CreateDb() => new(new DbContextOptionsBuilder<SmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
