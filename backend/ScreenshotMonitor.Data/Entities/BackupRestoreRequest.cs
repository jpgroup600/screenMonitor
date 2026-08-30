using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class BackupRestoreRequest
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    [Required] public string FileVersionId { get; set; } = string.Empty;
    [ForeignKey(nameof(FileVersionId))] public FileVersion FileVersion { get; set; } = null!;
    [Required] public string EmployeeId { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string DeviceId { get; set; } = string.Empty;
    [Required, MaxLength(2048)] public string OriginalPath { get; set; } = string.Empty;
    [Required, MaxLength(20)] public string Status { get; set; } = "Pending";
    public DateTime RequestedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    [MaxLength(2048)] public string? ResultPath { get; set; }
    [MaxLength(2048)] public string? Error { get; set; }
}
