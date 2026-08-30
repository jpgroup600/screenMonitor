using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class BackupInventoryRun
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    [Required] public string EmployeeId { get; set; } = string.Empty;
    [ForeignKey(nameof(EmployeeId))] public User Employee { get; set; } = null!;
    [Required, MaxLength(100)] public string DeviceId { get; set; } = string.Empty;
    [Required, MaxLength(30)] public string Status { get; set; } = "Scanning";
    public DateTime StartedAt { get; set; }
    public DateTime? InventoryCompletedAt { get; set; }
    public DateTime? BackupCompletedAt { get; set; }
    public ICollection<BackupInventoryItem> Items { get; set; } = new List<BackupInventoryItem>();
}
