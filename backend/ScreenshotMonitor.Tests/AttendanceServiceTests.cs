using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Services;
using ScreenshotMonitor.Data.Entities;
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
        var session = Assert.Single(db.Sessions);
        Assert.Null(session.ProjectId);
        Assert.Equal("Active", session.Status);
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
        Assert.Equal("Complete", Assert.Single(db.Sessions).Status);
    }

    [Fact]
    public async Task Clock_out_completes_the_active_project_session_and_apps()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 29, 0, 0, 0, TimeSpan.Zero));
        var service = new AttendanceService(db, clock);
        await service.ClockInAsync("employee-1");
        db.Sessions.RemoveRange(db.Sessions);
        var projectSession = new Session
        {
            EmployeeId = "employee-1",
            ProjectId = "project-1",
            StartTime = clock.GetUtcNow().UtcDateTime,
            Status = "Active"
        };
        db.Sessions.Add(projectSession);
        db.SessionForegroundApps.Add(new SessionForegroundApp
        {
            SessionId = projectSession.Id,
            AppName = "editor",
            StartTime = clock.GetUtcNow().UtcDateTime,
            Status = "Active"
        });
        await db.SaveChangesAsync();

        clock.Advance(TimeSpan.FromHours(1));
        await service.ClockOutAsync("employee-1");

        Assert.Equal("Complete", projectSession.Status);
        Assert.Equal(TimeSpan.FromHours(1), projectSession.ActiveDuration);
        var app = Assert.Single(db.SessionForegroundApps);
        Assert.Equal("Inactive", app.Status);
        Assert.Equal(TimeSpan.FromHours(1), app.TotalUsageTime);
    }

    [Fact]
    public async Task Resume_monitoring_creates_a_generic_session_only_during_attendance()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 29, 0, 0, 0, TimeSpan.Zero));
        var service = new AttendanceService(db, clock);

        Assert.False(await service.ResumeMonitoringAsync("employee-1"));
        await service.ClockInAsync("employee-1");
        var firstSession = Assert.Single(db.Sessions);
        firstSession.Status = "Complete";
        firstSession.EndTime = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync();

        Assert.True(await service.ResumeMonitoringAsync("employee-1"));
        Assert.Equal(2, await db.Sessions.CountAsync());
        var active = await db.Sessions.SingleAsync(x => x.Status == "Active");
        Assert.Null(active.ProjectId);
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

    [Fact]
    public async Task Admin_report_filters_dates_and_calculates_summary()
    {
        await using var db = CreateDb();
        var employee = new User
        {
            Id = "employee-1",
            FullName = "Kim Employee",
            Email = "kim@example.com",
            PasswordHash = "hash",
            Role = "Employee",
            Designation = "Engineer",
            PhoneNumber = ""
        };
        db.Users.Add(employee);
        db.AttendanceRecords.AddRange(
            new AttendanceRecord
            {
                EmployeeId = employee.Id,
                Employee = employee,
                ClockInAt = new DateTime(2026, 8, 29, 0, 0, 0, DateTimeKind.Utc),
                ClockOutAt = new DateTime(2026, 8, 29, 8, 0, 0, DateTimeKind.Utc),
                TotalIdleDuration = TimeSpan.FromHours(1),
                Status = "Complete"
            },
            new AttendanceRecord
            {
                EmployeeId = employee.Id,
                Employee = employee,
                ClockInAt = new DateTime(2026, 8, 28, 0, 0, 0, DateTimeKind.Utc),
                ClockOutAt = new DateTime(2026, 8, 28, 8, 0, 0, DateTimeKind.Utc),
                Status = "Complete"
            });
        await db.SaveChangesAsync();
        var service = new AttendanceService(db, new FakeTimeProvider(DateTimeOffset.UtcNow));

        var report = await service.AdminReportAsync(
            new DateTime(2026, 8, 29, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 8, 30, 0, 0, 0, DateTimeKind.Utc),
            null,
            null);

        Assert.Single(report.Records);
        Assert.Equal(TimeSpan.FromHours(8), report.Summary.TotalWorkDuration);
        Assert.Equal(TimeSpan.FromHours(1), report.Summary.TotalIdleDuration);
        Assert.Equal(TimeSpan.FromHours(7), report.Records[0].ProductiveDuration);
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
