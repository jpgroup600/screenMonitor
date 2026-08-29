using System;

namespace ScreenshotMonitor.Data.Dto.Project;

public class ProjectDto
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string AdminId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EndDate { get; set; }
    public string Status { get; set; }
}