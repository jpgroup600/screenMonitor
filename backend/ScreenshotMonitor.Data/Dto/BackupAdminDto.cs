using System;
using System.Collections.Generic;

namespace ScreenshotMonitor.Data.Dto;

public record BackupFileListDto(string Id, string EmployeeId, string EmployeeName, string DeviceId, string OriginalPath, int VersionCount, long LatestSizeBytes, DateTime LastBackedUpAt);
public record BackupVersionDto(string Id, string ContentHash, long PlainSizeBytes, DateTime SourceModifiedAt, DateTime UploadedAt);
public record BackupFileDetailDto(string Id, string EmployeeId, string EmployeeName, string DeviceId, string OriginalPath, IReadOnlyList<BackupVersionDto> Versions);
