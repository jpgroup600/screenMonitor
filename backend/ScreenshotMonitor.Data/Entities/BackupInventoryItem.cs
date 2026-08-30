using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class BackupInventoryItem
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    [Required] public string RunId { get; set; } = string.Empty;
    [ForeignKey(nameof(RunId))] public BackupInventoryRun Run { get; set; } = null!;
    [Required, MaxLength(2048)] public string Path { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public long? ModifiedUnixSeconds { get; set; }
    public bool RequiresBackup { get; set; } = true;
    [Required, MaxLength(20)] public string Status { get; set; } = "Pending";
    [MaxLength(2048)] public string? Error { get; set; }
    public DateTime DiscoveredAt { get; set; }
    public DateTime? BackedUpAt { get; set; }
}
