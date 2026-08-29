using System;
using System.Collections.Generic;

namespace ScreenshotMonitor.Data.Dto.Project;

public class AppNameDto
{
    public string AppName { get; set; } = string.Empty;
}

public class SessionIdDto
{
    public string SessionId { get; set; } = string.Empty;
}

public class ProjectEmployeeSummaryDto
{
    public string Id { get; set; }
    public string FullName { get; set; }
    public string Email { get; set; }
    public string PasswordHash { get; set; }
    public string Role { get; set; }
    public string Designation { get; set; }
    public string PhoneNumber { get; set; }
    public DateTime CreatedAt { get; set; }
    public TimeSpan TotalOnlineTime { get; set; }

    // Newly added properties
    public string RecentScreenshot { get; set; }
    public List<AppUsageDto> TopApps { get; set; } = new List<AppUsageDto>();
}


public class AppUsageDto
{
    public string Name { get; set; }
    public string Usage { get; set; } // "4h 23m" format
}
public class ScreenshotIntervalRequest
{
    public int Seconds { get; set; }

    public TimeSpan GetTimeSpan() => TimeSpan.FromSeconds(Seconds);
}
