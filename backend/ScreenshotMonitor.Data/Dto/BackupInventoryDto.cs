using System;
using System.Collections.Generic;

namespace ScreenshotMonitor.Data.Dto;

public record InventoryStartDto(string DeviceId);
public record InventoryEntryDto(string Path, long SizeBytes, long? ModifiedUnixSeconds, bool RequiresBackup = true);
public record InventoryBatchDto(IReadOnlyList<InventoryEntryDto> Files);
public record InventoryRunDto(string Id, string EmployeeId, string EmployeeName, string DeviceId, string Status, DateTime StartedAt, DateTime? InventoryCompletedAt, DateTime? BackupCompletedAt, bool BackupRequested, long DiscoveredFiles, long DiscoveredBytes, long SkippedEntries, long InaccessibleEntries, string CurrentPath, DateTime? LastProgressAt);
public record InventoryProgressUpdateDto(long DiscoveredFiles, long DiscoveredBytes, long SkippedEntries, long InaccessibleEntries, string CurrentPath);
public record InventoryProgressDto(string RunId, string Status, int Total, int Pending, int BackedUp, int Failed, int Excluded, int Unchanged,
    bool BackupRequested, long DiscoveredFiles, long DiscoveredBytes, long SkippedEntries, long InaccessibleEntries, string CurrentPath,
    DateTime? LastProgressAt, DateTime? LastBackupActivityAt);
public record InventoryItemDto(string Id, string RunId, string Path, long SizeBytes, long? ModifiedUnixSeconds, string Status, string? Error, DateTime DiscoveredAt, DateTime? BackedUpAt);
public record InventoryFolderDto(string Path, string Name, string? ParentPath, int Depth, int FileCount, long SizeBytes, int Pending, int BackedUp, int Failed, int Excluded, int Unchanged);
public record BackupPathRuleDto(string Id, string DeviceId, string Path, string Action, DateTime CreatedAt);
public record SetBackupPathRuleDto(string DeviceId, string Path, string Action);
public record SetBackupPathRulesDto(string DeviceId, IReadOnlyList<string> Paths, string Action);
public record InventoryItemResultDto(bool Succeeded, string? Error);
