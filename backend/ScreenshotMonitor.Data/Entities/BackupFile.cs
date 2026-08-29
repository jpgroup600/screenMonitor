using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class BackupFile
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    [Required] public string EmployeeId { get; set; } = string.Empty;
    [ForeignKey(nameof(EmployeeId))] public User Employee { get; set; } = null!;
    [Required, MaxLength(100)] public string DeviceId { get; set; } = string.Empty;
    [Required, MaxLength(2048)] public string OriginalPath { get; set; } = string.Empty;
    public DateTime FirstSeenAt { get; set; }
    public DateTime LastSeenAt { get; set; }
    public ICollection<FileVersion> Versions { get; set; } = new List<FileVersion>();
}
