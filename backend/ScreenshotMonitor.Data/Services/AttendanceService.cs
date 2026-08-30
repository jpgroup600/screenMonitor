using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Dto.Attendance;

namespace ScreenshotMonitor.Data.Services;

public class AttendanceService(SmDbContext dbContext, TimeProvider timeProvider)
{
    public Task<AttendanceRecord?> GetCurrentAsync(string employeeId, bool tracking = false)
    {
        var query = dbContext.AttendanceRecords.Where(x =>
            x.EmployeeId == employeeId && x.Status == "Active");
        return tracking ? query.FirstOrDefaultAsync() : query.AsNoTracking().FirstOrDefaultAsync();
    }

    public async Task<AttendanceRecord> ClockInAsync(string employeeId)
    {
        var existing = await GetCurrentAsync(employeeId, true);
        if (existing is not null) return existing;

        var record = new AttendanceRecord
        {
            EmployeeId = employeeId,
            ClockInAt = timeProvider.GetUtcNow().UtcDateTime
        };
        dbContext.AttendanceRecords.Add(record);
        await RotateMonitoringSessionAsync(employeeId, record.ClockInAt);
        await dbContext.SaveChangesAsync();
        return record;
    }

    public async Task<AttendanceRecord?> ClockOutAsync(string employeeId)
    {
        var record = await ActiveWithIdlePeriods(employeeId);
        if (record is null) return null;

        var now = timeProvider.GetUtcNow().UtcDateTime;
        CloseIdlePeriod(record, now);
        record.ClockOutAt = now;
        record.Status = "Complete";
        await RotateMonitoringSessionAsync(employeeId, now);
        await dbContext.SaveChangesAsync();
        return record;
    }

    public async Task<bool> ResumeMonitoringAsync(string employeeId)
    {
        return await GetCurrentAsync(employeeId) is not null;
    }

    public async Task<bool> RecordIdleAsync(string employeeId, string eventName)
    {
        var record = await ActiveWithIdlePeriods(employeeId);
        if (record is null) return false;

        var now = timeProvider.GetUtcNow().UtcDateTime;
        if (eventName.Equals("start", StringComparison.OrdinalIgnoreCase))
        {
            if (!record.IdlePeriods.Any(x => x.EndedAt == null))
            {
                record.IdlePeriods.Add(new AttendanceIdlePeriod { StartedAt = now });
            }
        }
        else if (eventName.Equals("end", StringComparison.OrdinalIgnoreCase))
        {
            CloseIdlePeriod(record, now);
        }
        else
        {
            throw new ArgumentException("Event must be start or end.", nameof(eventName));
        }

        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<int> AutoCloseBeforeAsync(DateTime cutoffUtc)
    {
        cutoffUtc = cutoffUtc.ToUniversalTime();
        var records = await dbContext.AttendanceRecords.Include(x => x.IdlePeriods)
            .Where(x => x.Status == "Active" && x.ClockInAt < cutoffUtc).ToListAsync();
        foreach (var record in records)
        {
            var openIdle = record.IdlePeriods.FirstOrDefault(x => x.EndedAt == null);
            if (openIdle is not null && openIdle.StartedAt >= cutoffUtc)
            {
                dbContext.AttendanceIdlePeriods.Remove(openIdle);
            }
            else
            {
                CloseIdlePeriod(record, cutoffUtc);
            }
            record.ClockOutAt = cutoffUtc;
            record.Status = "Complete";
            await RotateMonitoringSessionAsync(record.EmployeeId, cutoffUtc);
        }
        if (records.Count > 0) await dbContext.SaveChangesAsync();
        return records.Count;
    }

    private async Task RotateMonitoringSessionAsync(string employeeId, DateTime boundary)
    {
        var activeSessions = await dbContext.Sessions.Include(x => x.ForegroundApps)
            .Where(x => x.EmployeeId == employeeId && x.ProjectId == null && x.Status == "Active").ToListAsync();
        foreach (var session in activeSessions)
        {
            foreach (var app in session.ForegroundApps.Where(x => x.Status == "Active"))
            {
                app.EndTime = boundary;
                app.TotalUsageTime = boundary > app.StartTime ? boundary - app.StartTime : TimeSpan.Zero;
                app.Status = "Inactive";
            }
            session.EndTime = boundary;
            session.ActiveDuration = boundary > session.StartTime ? boundary - session.StartTime : TimeSpan.Zero;
            session.Status = "Complete";
        }
        dbContext.Sessions.Add(new Session {
            EmployeeId = employeeId,
            ProjectId = null,
            StartTime = boundary,
            ActiveDuration = TimeSpan.Zero,
            Status = "Active"
        });
    }

    public static DateTime LatestSeoulFourAmCutoff(DateTimeOffset nowUtc)
    {
        var seoul = nowUtc.ToOffset(TimeSpan.FromHours(9));
        var date = seoul.TimeOfDay >= TimeSpan.FromHours(4) ? seoul.Date : seoul.Date.AddDays(-1);
        return new DateTimeOffset(date.AddHours(4), TimeSpan.FromHours(9)).UtcDateTime;
    }

    public Task<List<AttendanceRecord>> HistoryAsync(string employeeId, int take) =>
        dbContext.AttendanceRecords.AsNoTracking()
            .Where(x => x.EmployeeId == employeeId)
            .OrderByDescending(x => x.ClockInAt)
            .Take(Math.Clamp(take, 1, 100))
            .ToListAsync();

    public async Task<AdminAttendanceResponseDto> AdminReportAsync(
        DateTime? from,
        DateTime? to,
        string? employeeId,
        string? status)
    {
        var query = dbContext.AttendanceRecords.AsNoTracking().Include(x => x.Employee).AsQueryable();
        if (from.HasValue) query = query.Where(x => x.ClockInAt >= from.Value.ToUniversalTime());
        if (to.HasValue) query = query.Where(x => x.ClockInAt < to.Value.ToUniversalTime());
        if (!string.IsNullOrWhiteSpace(employeeId)) query = query.Where(x => x.EmployeeId == employeeId);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);

        var records = await query.OrderByDescending(x => x.ClockInAt).ToListAsync();
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var rows = records.Select(x =>
        {
            var work = (x.ClockOutAt ?? now) - x.ClockInAt;
            var productive = work > x.TotalIdleDuration ? work - x.TotalIdleDuration : TimeSpan.Zero;
            return new AdminAttendanceRowDto(
                x.Id,
                x.EmployeeId,
                x.Employee.FullName,
                x.Employee.Email,
                x.ClockInAt,
                x.ClockOutAt,
                work,
                x.TotalIdleDuration,
                productive,
                x.Status);
        }).ToList();

        var summary = new AdminAttendanceSummaryDto(
            rows.Count,
            rows.Count(x => x.Status == "Active"),
            rows.Count(x => x.Status == "Complete"),
            TimeSpan.FromTicks(rows.Sum(x => x.WorkDuration.Ticks)),
            TimeSpan.FromTicks(rows.Sum(x => x.TotalIdleDuration.Ticks)));
        return new AdminAttendanceResponseDto(summary, rows);
    }

    private Task<AttendanceRecord?> ActiveWithIdlePeriods(string employeeId) =>
        dbContext.AttendanceRecords.Include(x => x.IdlePeriods).FirstOrDefaultAsync(x =>
            x.EmployeeId == employeeId && x.Status == "Active");

    private static void CloseIdlePeriod(AttendanceRecord record, DateTime endedAt)
    {
        var idle = record.IdlePeriods.FirstOrDefault(x => x.EndedAt == null);
        if (idle is null) return;
        idle.EndedAt = endedAt;
        idle.Duration = endedAt - idle.StartedAt;
        record.TotalIdleDuration += idle.Duration;
    }
}
