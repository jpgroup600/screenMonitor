using System;

namespace ScreenshotMonitor.Data.Dto.Security;

public record SecurityEventRequestDto(string DeviceId, string EventType, string Source, string Details);
public record SecurityEventResponseDto(string Id, string EmployeeId, string EmployeeName, string DeviceId, string EventType, string Source, string Severity, string Details, DateTime OccurredAt);
