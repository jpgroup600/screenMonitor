using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class SecurityEventServiceTests
{
    [Fact]
    public async Task External_network_signal_is_recorded_as_warning_without_claiming_confirmed_transfer()
    {
        await using var db = CreateDb(); await SeedDevice(db);
        var service = new SecurityEventService(db, TimeProvider.System);
        var entry = await service.RecordAsync("employee-1", "device-1", "NETWORK_TRANSFER", "8.8.8.8:443", "{\"confirmedFileTransfer\":false}");
        Assert.Equal("Warning", entry.Severity); Assert.Contains("false", entry.Details);
    }
    [Theory]
    [InlineData("FILE_DELETED")]
    [InlineData("FILE_MOVED")]
    [InlineData("FILE_CREATED")]
    [InlineData("FILE_MODIFIED")]
    [InlineData("USB_FILE_WRITTEN")]
    [InlineData("NETWORK_CONNECTION")]
    public async Task Records_file_lifecycle_events(string eventType)
    {
        await using var db = CreateDb(); await SeedDevice(db);
        var service = new SecurityEventService(db, TimeProvider.System);
        var entry = await service.RecordAsync("employee-1", "device-1", eventType, @"C:\Work\file.txt", "{}");
        Assert.Equal(eventType, entry.EventType);
    }
    [Fact]
    public async Task Records_usb_connection_with_warning_severity()
    {
        await using var db = CreateDb(); await SeedDevice(db);
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
    [Fact]
    public async Task Rejects_events_for_another_employees_device()
    {
        await using var db = CreateDb(); await SeedDevice(db);
        var service = new SecurityEventService(db, TimeProvider.System);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.RecordAsync("employee-2", "device-1", "FILE_MODIFIED", @"C:\Work\a.txt", "{}"));
    }
    [Theory]
    [InlineData("not-json")]
    [InlineData("{broken}")]
    public async Task Rejects_non_json_details(string details)
    {
        await using var db = CreateDb(); await SeedDevice(db);
        var service = new SecurityEventService(db, TimeProvider.System);
        await Assert.ThrowsAsync<ArgumentException>(() => service.RecordAsync("employee-1", "device-1", "FILE_MODIFIED", @"C:\Work\a.txt", details));
    }
    private static User Employee() => new() { Id="employee-1", FullName="Employee", Email="e@example.com", PasswordHash="hash", Role="Employee", Designation="", PhoneNumber="" };
    private static async Task SeedDevice(SmDbContext db)
    {
        db.Users.Add(Employee());
        db.Devices.Add(new Device { Id = "device-1", EmployeeId = "employee-1", Name = "PC", OperatingSystem = "Windows", Status = "Active" });
        await db.SaveChangesAsync();
    }
    private static SmDbContext CreateDb() => new(new DbContextOptionsBuilder<SmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
