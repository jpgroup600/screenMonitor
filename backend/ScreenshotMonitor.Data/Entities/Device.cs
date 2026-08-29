using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class Device
{
    [Key, MaxLength(100)] public string Id { get; set; } = string.Empty;
    [Required] public string EmployeeId { get; set; } = string.Empty;
    [ForeignKey(nameof(EmployeeId))] public User Employee { get; set; } = null!;
    [MaxLength(200)] public string Name { get; set; } = string.Empty;
    [MaxLength(500)] public string OperatingSystem { get; set; } = string.Empty;
    public DateTime RegisteredAt { get; set; }
    public DateTime LastSeenAt { get; set; }
    [MaxLength(20)] public string Status { get; set; } = "Active";
}
