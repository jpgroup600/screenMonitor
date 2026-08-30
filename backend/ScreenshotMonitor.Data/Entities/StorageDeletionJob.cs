using System;
using System.ComponentModel.DataAnnotations;

namespace ScreenshotMonitor.Data.Entities;

public class StorageDeletionJob
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    [Required, MaxLength(1024)] public string ObjectKey { get; set; } = string.Empty;
    public int Attempts { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime NextAttemptAt { get; set; }
    [MaxLength(2048)] public string LastError { get; set; } = string.Empty;
}
