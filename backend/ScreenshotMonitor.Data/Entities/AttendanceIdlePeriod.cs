using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class AttendanceIdlePeriod
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string AttendanceRecordId { get; set; } = string.Empty;

    [ForeignKey(nameof(AttendanceRecordId))]
    public AttendanceRecord AttendanceRecord { get; set; } = null!;

    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public TimeSpan Duration { get; set; }
}
