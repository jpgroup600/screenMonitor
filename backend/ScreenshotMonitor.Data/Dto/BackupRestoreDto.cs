using System;

namespace ScreenshotMonitor.Data.Dto;

public record BackupRestoreRequestDto(string FileVersionId);
public record BackupRestoreCompleteDto(bool Succeeded, string? ResultPath, string? Error);
public record BackupRestoreResponseDto(string Id, string FileVersionId, string EmployeeId, string DeviceId, string OriginalPath, string Status, DateTime RequestedAt, DateTime? CompletedAt, string? ResultPath, string? Error);
