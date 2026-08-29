using System;

namespace ScreenshotMonitor.Data.Dto.Backup;

public record BackupUploadResponseDto(string FileId, string VersionId, string ObjectKey, bool Deduplicated, DateTime UploadedAt);
