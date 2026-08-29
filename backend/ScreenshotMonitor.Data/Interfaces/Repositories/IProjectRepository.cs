using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ScreenshotMonitor.Data.Dto.Project;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Interfaces.Repositories;

public interface IProjectRepository
{
    Task<bool> SetScreenshotIntervalAsync(string projectId, string employeeId, TimeSpan? interval);
    Task<TimeSpan?> GetScreenshotIntervalAsync(string projectId, string employeeId);
    Task<List<ProjectEmployeeSummaryDto>> GetProjectEmployeesSummaryAsync(string projectId);
    Task<IEnumerable<User>> GetEmployeesByProjectIdAsync(string projectId);
    Task<Project?> GetProjectByIdAsync(string projectId);
    Task<IEnumerable<Project>> GetAllProjectsAsync();
    Task<IEnumerable<Project>> GetProjectsByEmployeeIdAsync(string employeeId);
    Task<bool> CreateProjectAsync(Project project);
    Task<bool> DeleteProjectAsync(string projectId);
    Task<bool> AddEmployeeToProjectAsync(string projectId, string employeeId);
    Task<bool> RemoveEmployeeFromProjectAsync(string projectId, string employeeId);
}
