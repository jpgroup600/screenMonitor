using System;
using System.ComponentModel.DataAnnotations;

namespace ScreenshotMonitor.Data.Entities;

public class AdminAuditLog
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    public long Sequence { get; set; }
    [Required] public string AdminId { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Action { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string TargetType { get; set; } = string.Empty;
    [Required, MaxLength(200)] public string TargetId { get; set; } = string.Empty;
    [Required] public string BeforeJson { get; set; } = "{}";
    [Required] public string AfterJson { get; set; } = "{}";
    [Required, MaxLength(64)] public string PreviousHash { get; set; } = new('0', 64);
    [Required, MaxLength(64)] public string EntryHash { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
}
