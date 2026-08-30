using System;
using System.Collections.Generic;

namespace ScreenshotMonitor.Data.Dto;

public record InventoryStartDto(string DeviceId);
public record InventoryEntryDto(string Path, long SizeBytes, long? ModifiedUnixSeconds);
public record InventoryBatchDto(IReadOnlyList<InventoryEntryDto> Files);
public record InventoryRunDto(string Id, string EmployeeId, string EmployeeName, string DeviceId, string Status, DateTime StartedAt, DateTime? InventoryCompletedAt, DateTime? BackupCompletedAt);
public record InventoryProgressDto(string RunId, string Status, int Total, int Pending, int BackedUp, int Failed, int Excluded);
public record InventoryItemDto(string Id, string RunId, string Path, long SizeBytes, long? ModifiedUnixSeconds, string Status, string? Error, DateTime DiscoveredAt, DateTime? BackedUpAt);
public record BackupPathRuleDto(string Id, string DeviceId, string Path, string Action, DateTime CreatedAt);
public record SetBackupPathRuleDto(string DeviceId, string Path, string Action);
public record InventoryItemResultDto(bool Succeeded, string? Error);
