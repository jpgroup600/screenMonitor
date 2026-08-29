using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class AttendanceServiceTests
{
    [Fact]
    public async Task ClockIn_is_idempotent_while_an_attendance_is_active()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 29, 0, 0, 0, TimeSpan.Zero));
        var service = new AttendanceService(db, clock);

        var first = await service.ClockInAsync("employee-1");
        clock.Advance(TimeSpan.FromMinutes(5));
        var second = await service.ClockInAsync("employee-1");

        Assert.Equal(first.Id, second.Id);
        Assert.Single(db.AttendanceRecords);
    }

    [Fact]
    public async Task Idle_period_is_deduplicated_and_added_to_clock_out_total()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 29, 0, 0, 0, TimeSpan.Zero));
        var service = new AttendanceService(db, clock);
        await service.ClockInAsync("employee-1");

        await service.RecordIdleAsync("employee-1", "start");
        await service.RecordIdleAsync("employee-1", "start");
        clock.Advance(TimeSpan.FromMinutes(7));
        var completed = await service.ClockOutAsync("employee-1");

        Assert.NotNull(completed);
        Assert.Equal(TimeSpan.FromMinutes(7), completed.TotalIdleDuration);
        Assert.Equal("Complete", completed.Status);
        Assert.Single(db.AttendanceIdlePeriods);
    }

    [Fact]
    public async Task Invalid_idle_event_is_rejected()
    {
        await using var db = CreateDb();
        var service = new AttendanceService(db, new FakeTimeProvider(DateTimeOffset.UtcNow));
        await service.ClockInAsync("employee-1");

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.RecordIdleAsync("employee-1", "unknown"));
    }

    private static SmDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<SmDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new SmDbContext(options);
    }

    private sealed class FakeTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset _now = now;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan duration) => _now += duration;
    }
}
