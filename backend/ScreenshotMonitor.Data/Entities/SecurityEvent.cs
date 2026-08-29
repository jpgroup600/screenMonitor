using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class SecurityEvent
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    [Required] public string EmployeeId { get; set; } = string.Empty;
    [ForeignKey(nameof(EmployeeId))] public User Employee { get; set; } = null!;
    [MaxLength(100)] public string DeviceId { get; set; } = string.Empty;
    [Required, MaxLength(50)] public string EventType { get; set; } = string.Empty;
    [MaxLength(500)] public string Source { get; set; } = string.Empty;
    [MaxLength(20)] public string Severity { get; set; } = "Info";
    public string Details { get; set; } = "{}";
    public DateTime OccurredAt { get; set; }
}
