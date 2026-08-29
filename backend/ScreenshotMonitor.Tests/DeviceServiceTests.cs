using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class DeviceServiceTests
{
    [Fact]
    public async Task Heartbeat_registers_then_updates_the_same_device()
    {
        await using var db = CreateDb();
        db.Users.Add(Employee()); await db.SaveChangesAsync();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 30, 0, 0, 0, TimeSpan.Zero));
        var service = new DeviceService(db, clock);
        var first = await service.HeartbeatAsync("employee-1", "device-1", "PC-1", "Windows");
        clock.Advance(TimeSpan.FromMinutes(1));
        var second = await service.HeartbeatAsync("employee-1", "device-1", "PC-1", "Windows 11");
        Assert.Equal(first.Id, second.Id); Assert.Single(db.Devices); Assert.Equal(clock.GetUtcNow().UtcDateTime, second.LastSeenAt);
    }

    [Fact]
    public async Task Blocked_device_rejects_heartbeat()
    {
        await using var db = CreateDb(); db.Users.Add(Employee()); await db.SaveChangesAsync();
        var service = new DeviceService(db, TimeProvider.System);
        await service.HeartbeatAsync("employee-1", "device-1", "PC", "Windows");
        Assert.True(await service.SetStatusAsync("device-1", "Blocked"));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.HeartbeatAsync("employee-1", "device-1", "PC", "Windows"));
    }

    private static User Employee() => new() { Id = "employee-1", FullName = "Employee", Email = "e@example.com", PasswordHash = "hash", Role = "Employee", Designation = "", PhoneNumber = "" };
    private static SmDbContext CreateDb() => new(new DbContextOptionsBuilder<SmDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private sealed class FakeTimeProvider(DateTimeOffset now) : TimeProvider { private DateTimeOffset current = now; public override DateTimeOffset GetUtcNow() => current; public void Advance(TimeSpan value) => current += value; }
}
