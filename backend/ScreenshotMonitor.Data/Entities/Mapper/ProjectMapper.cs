using System;
using ScreenshotMonitor.Data.Dto.Project;

namespace ScreenshotMonitor.Data.Entities.Mapper;

public static class ProjectMapper
{
    public static ProjectDto ToDto(Project project) => new()
    {
        Id = project.Id,
        Name = project.Name,
        Description = project.Description,
        AdminId = project.AdminId,
        CreatedAt = project.CreatedAt,
        EndDate = project.EndDate,
        Status = project.Status
    };

    public static Project ToEntity(ProjectDto dto) => new()
    {
        Id = Guid.NewGuid().ToString(),
        Name = dto.Name,
        Description = dto.Description,
        AdminId = dto.AdminId,
        CreatedAt = DateTime.UtcNow,
        EndDate = dto.EndDate,
        Status = dto.Status
    };
}
