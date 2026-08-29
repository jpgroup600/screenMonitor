using System;
using System.Collections.Generic;

namespace ScreenshotMonitor.Data.Dto.Attendance;

public record AttendanceResponseDto(
    string Id,
    DateTime ClockInAt,
    DateTime? ClockOutAt,
    TimeSpan TotalIdleDuration,
    string Status);

public record IdleEventRequestDto(string Event);

public record AdminAttendanceRowDto(
    string Id,
    string EmployeeId,
    string EmployeeName,
    string EmployeeEmail,
    DateTime ClockInAt,
    DateTime? ClockOutAt,
    TimeSpan WorkDuration,
    TimeSpan TotalIdleDuration,
    TimeSpan ProductiveDuration,
    string Status);

public record AdminAttendanceSummaryDto(
    int TotalRecords,
    int ActiveEmployees,
    int CompletedEmployees,
    TimeSpan TotalWorkDuration,
    TimeSpan TotalIdleDuration);

public record AdminAttendanceResponseDto(
    AdminAttendanceSummaryDto Summary,
    IReadOnlyList<AdminAttendanceRowDto> Records);
