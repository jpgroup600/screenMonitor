using System;
using System.Collections.Generic;

namespace ScreenshotMonitor.Data.Dto.Project;

public class UserDetailesDto
{
    public class UserProjectAppSummaryDto
    {
        public string UserId { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string Role { get; set; }
        public string Designation { get; set; }
        public string PhoneNumber { get; set; }
        public DateTime CreatedAt { get; set; }
        public TimeSpan TotalOnlineTime { get; set; }
        public List<ProjectInfoDto> Projects { get; set; }
        public List<AppUsageDto2> TopApps { get; set; }
    }

    public class ProjectInfoDto
    {
        public string ProjectId { get; set; }
        public string ProjectName { get; set; }
    }

    public class AppUsageDto2
    {
        public string AppName { get; set; }
        public TimeSpan TotalUsageTime { get; set; }
    }

}