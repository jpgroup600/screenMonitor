using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class DeviceSecurityPolicy
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    [Required, MaxLength(100)] public string DeviceId { get; set; } = string.Empty;
    [ForeignKey(nameof(DeviceId))] public Device Device { get; set; } = null!;
    public bool MonitoringEnabled { get; set; } = true;
    public bool ScreenshotsEnabled { get; set; } = true;
    public bool ActiveAppTrackingEnabled { get; set; } = true;
    public bool IdleTrackingEnabled { get; set; } = true;
    public bool BackupEnabled { get; set; } = true;
    public bool UsbAuditEnabled { get; set; } = true;
    public bool NetworkAuditEnabled { get; set; } = true;
    public bool FileChangeAuditEnabled { get; set; } = true;
    public bool AttendanceRemindersEnabled { get; set; } = true;
    public bool RestoreEnabled { get; set; } = true;
    public bool RetentionEnabled { get; set; }
    public int RetentionDays { get; set; } = 90;
    public long MaxBackupBytes { get; set; } = 50L * 1024 * 1024 * 1024;
    public int MaxVersionsPerFile { get; set; } = 20;
    [Required] public string UpdatedByAdminId { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}
