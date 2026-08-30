using System;

namespace ScreenshotMonitor.Data.Dto.Security;

public record DeviceSecurityPolicyDto(
    string DeviceId,
    bool MonitoringEnabled,
    bool ScreenshotsEnabled,
    bool ActiveAppTrackingEnabled,
    bool IdleTrackingEnabled,
    bool BackupEnabled,
    bool UsbAuditEnabled,
    bool NetworkAuditEnabled,
    bool FileChangeAuditEnabled,
    bool AttendanceRemindersEnabled,
    bool RestoreEnabled,
    bool RetentionEnabled,
    int RetentionDays,
    long MaxBackupBytes,
    int MaxVersionsPerFile,
    string UpdatedByAdminId,
    DateTime UpdatedAt);

public record UpdateDeviceSecurityPolicyDto(
    bool MonitoringEnabled,
    bool ScreenshotsEnabled,
    bool ActiveAppTrackingEnabled,
    bool IdleTrackingEnabled,
    bool BackupEnabled,
    bool UsbAuditEnabled,
    bool NetworkAuditEnabled,
    bool FileChangeAuditEnabled,
    bool AttendanceRemindersEnabled,
    bool RestoreEnabled,
    bool RetentionEnabled,
    int RetentionDays,
    long MaxBackupBytes,
    int MaxVersionsPerFile);

public record AdminAuditLogDto(
    string Id, long Sequence, string AdminId, string Action, string TargetType, string TargetId,
    string BeforeJson, string AfterJson, string PreviousHash, string EntryHash, DateTime OccurredAt);
