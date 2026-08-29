using System;
using System.ComponentModel.DataAnnotations;


namespace ScreenshotMonitor.Data.Dto.Session;

public class StartSessionRequestDto
{
    [Required] public string ProjectId { get; set; }
}

public class EndSessionRequestDto
{
    [Required] public string ProjectId { get; set; }
}

public class SessionResponseDto
{
    public string SessionId { get; set; }
    public string EmployeeId { get; set; }
    public string ProjectId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public TimeSpan ActiveDuration { get; set; }
    public string Status { get; set; }
}
