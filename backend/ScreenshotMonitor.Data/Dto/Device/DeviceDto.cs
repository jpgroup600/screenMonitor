using System;

namespace ScreenshotMonitor.Data.Dto.Device;

public record DeviceHeartbeatRequestDto(string DeviceId, string Name, string OperatingSystem);
public record DeviceResponseDto(string Id, string EmployeeId, string EmployeeName, string Name, string OperatingSystem, DateTime RegisteredAt, DateTime LastSeenAt, string Status);
public record DeviceStatusRequestDto(string Status);
