using System;
using System.ComponentModel.DataAnnotations;

namespace ScreenshotMonitor.Data.Dto.Project;

public class CreateProjectDto
{
    [Required, MaxLength(200)]
    public string Name { get; set; }

    [MaxLength(500)] public string Description { get; set; }
    
    //public DateTime? StartTime { get; set; }
    public DateTime? EndDate { get; set; }
  
    public string Status { get; set; }
}