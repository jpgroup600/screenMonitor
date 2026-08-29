using System;

namespace ScreenshotMonitor.Data.Dto.Attendance;

public record AttendanceResponseDto(
    string Id,
    DateTime ClockInAt,
    DateTime? ClockOutAt,
    TimeSpan TotalIdleDuration,
    string Status);

public record IdleEventRequestDto(string Event);
