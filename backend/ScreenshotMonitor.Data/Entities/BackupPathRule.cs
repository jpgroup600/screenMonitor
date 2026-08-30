using System;
using System.ComponentModel.DataAnnotations;

namespace ScreenshotMonitor.Data.Entities;

public class BackupPathRule
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    [Required, MaxLength(100)] public string DeviceId { get; set; } = string.Empty;
    [Required, MaxLength(2048)] public string Path { get; set; } = string.Empty;
    [Required, MaxLength(10)] public string Action { get; set; } = "Include";
    public DateTime CreatedAt { get; set; }
}
