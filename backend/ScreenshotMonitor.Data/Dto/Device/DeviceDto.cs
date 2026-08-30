using System;

namespace ScreenshotMonitor.Data.Dto.Device;

public record DeviceHeartbeatRequestDto(string DeviceId, string Name, string OperatingSystem, string? AgentVersion, string? AgentMode, string? MonitoringState, int PendingQueueItems = 0);
public record DeviceResponseDto(string Id, string EmployeeId, string EmployeeName, string Name, string OperatingSystem, DateTime RegisteredAt, DateTime LastSeenAt, string Status, string AgentVersion, string AgentMode, string MonitoringState, int PendingQueueItems);
public record DeviceStatusRequestDto(string Status);
