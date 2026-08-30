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
        Assert.Single(db.Sessions);
        Assert.Equal(first.ClockInAt, db.Sessions.Single().StartTime);
    }

    [Fact]
    public async Task ClockIn_rotates_off_hours_monitoring_into_a_new_work_session()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 29, 1, 0, 0, TimeSpan.Zero));
        var offHours = new Session { Id = "off-hours", EmployeeId = "employee-1", StartTime = clock.GetUtcNow().UtcDateTime.AddHours(-1), Status = "Active" };
        db.Sessions.Add(offHours);
        await db.SaveChangesAsync();
        var service = new AttendanceService(db, clock);

        var attendance = await service.ClockInAsync("employee-1");

        Assert.Equal("Complete", offHours.Status);
        Assert.Equal(attendance.ClockInAt, offHours.EndTime);
        var workSession = Assert.Single(db.Sessions.Where(x => x.Status == "Active"));
        Assert.NotEqual(offHours.Id, workSession.Id);
        Assert.Equal(attendance.ClockInAt, workSession.StartTime);
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
        Assert.Equal(2, db.Sessions.Count());
    }

    [Fact]
    public async Task Clock_out_rotates_the_general_monitoring_session_without_stopping_tracking()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 29, 0, 0, 0, TimeSpan.Zero));
        var service = new AttendanceService(db, clock);
        await service.ClockInAsync("employee-1");
        var monitoringSession = db.Sessions.Single();
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
            SessionId = monitoringSession.Id,
            AppName = "editor",
            StartTime = clock.GetUtcNow().UtcDateTime,
            Status = "Active"
        });
        await db.SaveChangesAsync();

        clock.Advance(TimeSpan.FromHours(1));
        await service.ClockOutAsync("employee-1");

        Assert.Equal("Active", projectSession.Status);
        Assert.Equal("Complete", monitoringSession.Status);
        Assert.Equal(TimeSpan.FromHours(1), monitoringSession.ActiveDuration);
        Assert.Single(db.Sessions.Where(x => x.ProjectId == null && x.Status == "Active"));
        var app = Assert.Single(db.SessionForegroundApps);
        Assert.Equal("Inactive", app.Status);
        Assert.Equal(TimeSpan.FromHours(1), app.TotalUsageTime);
    }

    [Fact]
    public async Task Legacy_attendance_resume_only_reports_active_attendance()
    {
        await using var db = CreateDb();
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 29, 0, 0, 0, TimeSpan.Zero));
        var service = new AttendanceService(db, clock);

        Assert.False(await service.ResumeMonitoringAsync("employee-1"));
        await service.ClockInAsync("employee-1");
        Assert.True(await service.ResumeMonitoringAsync("employee-1"));
        Assert.Single(db.Sessions);
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

    [Fact]
    public async Task Four_am_cutoff_closes_only_attendance_started_before_the_latest_seoul_cutoff()
    {
        await using var db = CreateDb();
        var now = new DateTimeOffset(2026, 8, 30, 5, 0, 0, TimeSpan.FromHours(9));
        var cutoff = AttendanceService.LatestSeoulFourAmCutoff(now.ToUniversalTime());
        db.AttendanceRecords.AddRange(
            new AttendanceRecord { Id = "old", EmployeeId = "employee-1", ClockInAt = cutoff.AddHours(-3), Status = "Active" },
            new AttendanceRecord { Id = "new", EmployeeId = "employee-2", ClockInAt = cutoff.AddMinutes(1), Status = "Active" });
        db.Sessions.Add(new Session { Id = "monitoring", EmployeeId = "employee-1", StartTime = cutoff.AddHours(-3), Status = "Active" });
        await db.SaveChangesAsync();
        var service = new AttendanceService(db, new FakeTimeProvider(now));

        Assert.Equal(1, await service.AutoCloseBeforeAsync(cutoff));

        Assert.Equal("Complete", (await db.AttendanceRecords.FindAsync("old"))!.Status);
        Assert.Equal(cutoff, (await db.AttendanceRecords.FindAsync("old"))!.ClockOutAt);
        Assert.Equal("Active", (await db.AttendanceRecords.FindAsync("new"))!.Status);
        Assert.Equal("Complete", (await db.Sessions.FindAsync("monitoring"))!.Status);
        Assert.Single(db.Sessions.Where(x => x.EmployeeId == "employee-1" && x.Status == "Active" && x.StartTime == cutoff));
    }

    [Theory]
    [InlineData("2026-08-30T03:59:00+09:00", "2026-08-28T19:00:00Z")]
    [InlineData("2026-08-30T04:00:00+09:00", "2026-08-29T19:00:00Z")]
    public void Latest_cutoff_uses_four_am_in_seoul(string now, string expectedUtc)
    {
        Assert.Equal(DateTimeOffset.Parse(expectedUtc).UtcDateTime,
            AttendanceService.LatestSeoulFourAmCutoff(DateTimeOffset.Parse(now).ToUniversalTime()));
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
