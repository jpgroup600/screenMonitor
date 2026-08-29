using System.ComponentModel.DataAnnotations;

namespace ScreenshotMonitor.Data.Dto.Project;

public class AssignEmployeeDto
{
    [Required]
    public string EmployeeId { get; set; }
}