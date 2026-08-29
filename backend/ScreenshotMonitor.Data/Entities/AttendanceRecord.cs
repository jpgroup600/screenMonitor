using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class AttendanceRecord
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public string EmployeeId { get; set; } = string.Empty;

    [ForeignKey(nameof(EmployeeId))]
    public User Employee { get; set; } = null!;

    public DateTime ClockInAt { get; set; }
    public DateTime? ClockOutAt { get; set; }
    public TimeSpan TotalIdleDuration { get; set; }
    public string Status { get; set; } = "Active";

    public ICollection<AttendanceIdlePeriod> IdlePeriods { get; set; } = new List<AttendanceIdlePeriod>();
}
