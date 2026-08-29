using System;
using System.Collections.Generic;

namespace ScreenshotMonitor.Data.Dto.Project;

public class EmployeeScreenshotDto
{
    public string EmployeeId { get; set; }
    public string EmployeeName { get; set; }
    public string ImageFilePath { get; set; }
    public DateTime TimeTaken { get; set; }
}

public class ScreenshotRequestDto
{
    public List<string> EmployeeIds { get; set; }
}