using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Dto.Project;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Interfaces.Repositories;

namespace ScreenshotMonitor.Data.Repositories;



public class ProjectRepository(
    IConfiguration conf,
    SmDbContext dbContext,
    ILogger<ProjectRepository> logger,
    IScreenshotRepository screenshotRepository
) : IProjectRepository
{
    
    
    private readonly SmDbContext _dbContext = dbContext;
    private readonly ILogger<ProjectRepository> _logger = logger;
    
    public async Task<bool> SetScreenshotIntervalAsync(string projectId, string employeeId, TimeSpan? interval)
    {
        try
        {
            var projectEmployee = await _dbContext.ProjectEmployees
                .FirstOrDefaultAsync(pe => pe.ProjectId == projectId && pe.EmployeeId == employeeId);

            if (projectEmployee == null)
            {
                _logger.LogWarning("ProjectEmployee not found for ProjectId {ProjectId} and EmployeeId {EmployeeId}", projectId, employeeId);
                return false;
            }

            projectEmployee.ScreenshotInterval = interval;
            await _dbContext.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error setting ScreenshotInterval for ProjectId {ProjectId} and EmployeeId {EmployeeId}", projectId, employeeId);
            return false;
        }
    }

    // ✅ Get Screenshot Interval
    public async Task<TimeSpan?> GetScreenshotIntervalAsync(string projectId, string employeeId)
    {
        try
        {
            var interval = await _dbContext.ProjectEmployees
                .Where(pe => pe.ProjectId == projectId && pe.EmployeeId == employeeId)
                .Select(pe => pe.ScreenshotInterval)
                .FirstOrDefaultAsync();

            return interval;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching ScreenshotInterval for ProjectId {ProjectId} and EmployeeId {EmployeeId}", projectId, employeeId);
            return null;
        }
    }
    public async Task<List<ProjectEmployeeSummaryDto>> GetProjectEmployeesSummaryAsync(string projectId)
{
    try
    {
        var employees = await _dbContext.ProjectEmployees
            .Where(pe => pe.ProjectId == projectId)
            .Select(pe => pe.Employee)
            .ToListAsync();

        var employeeSummaries = new List<ProjectEmployeeSummaryDto>();

        foreach (var employee in employees)
        {
            // Get all sessions of this employee in the project
            var employeeSessions = await _dbContext.Sessions
                .Where(s => s.ProjectId == projectId && s.EmployeeId == employee.Id)
                .Select(s => s.Id) // Only fetch session IDs
                .ToListAsync();

            string recentScreenshot = null;
            if (employeeSessions.Any())
            {
                var allScreenshots = new List<string>();

                foreach (var sessionId in employeeSessions)
                {
                    _logger.LogInformation("Getting screenshot for session {SessionId}", sessionId);
                    var sessionScreenshots = await screenshotRepository.
                        FetchScreenshotsBySessionIdAsync(sessionId);
                    allScreenshots.AddRange(sessionScreenshots);
                }

                if (!allScreenshots.Any())
                {
                    _logger.LogWarning("Screenshots list is empty for employee {EmployeeId} in project {ProjectId}", employee.Id, projectId);
                }
                else
                {
                    _logger.LogInformation("Found {Count} screenshots for employee {EmployeeId}", allScreenshots.Count, employee.Id);

                    // Debug: Log all file paths found
                    foreach (var file in allScreenshots)
                    {
                        _logger.LogInformation("Screenshot file found: {FilePath}", file);
                    }

                    // Validate files exist before sorting
                    var validScreenshots = allScreenshots.Where(File.Exists).ToList();

                    if (!validScreenshots.Any())
                    {
                        _logger.LogWarning("No valid screenshot files exist on disk.");
                    }
                    else
                    {
                        recentScreenshot = validScreenshots
                            .Select(f => new FileInfo(f))
                            .OrderByDescending(f => f.CreationTimeUtc)
                            .FirstOrDefault()?.FullName;

                        _logger.LogInformation("Most recent screenshot: {RecentScreenshot}", recentScreenshot);
                    }
                }
            }



            // Fetch all session foreground apps for this employee in the project
            var appUsages = await _dbContext.SessionForegroundApps
                .Where(a => a.Session.ProjectId == projectId && a.Session.EmployeeId == employee.Id)
                .Select(a => new 
                {
                    a.AppName,
                    TotalUsageTicks = a.TotalUsageTime.Ticks // Convert to long for processing
                })
                .ToListAsync(); // Fetch from DB before processing in memory

// Group by AppName and calculate total usage in memory
            var topApps = appUsages
                .GroupBy(a => a.AppName)
                .Select(g => new 
                {
                    Name = g.Key,
                    UsageTime = TimeSpan.FromTicks(g.Sum(a => a.TotalUsageTicks)) // Safe to sum now
                })
                .OrderByDescending(a => a.UsageTime)
                .Take(3)
                .ToList();

// Convert TimeSpan to readable format ("4h 23m")
            var formattedTopApps = topApps.Select(app => new AppUsageDto
            {
                Name = app.Name,
                Usage = $"{(int)app.UsageTime.TotalHours}h {app.UsageTime.Minutes}m"
            }).ToList();
            employeeSummaries.Add(new ProjectEmployeeSummaryDto
            {
                Id = employee.Id,
                FullName = employee.FullName,
                Email = employee.Email,
                Role = employee.Role,
                Designation = employee.Designation,
                PhoneNumber = employee.PhoneNumber,
                CreatedAt = employee.CreatedAt,
                TotalOnlineTime = employee.TotalOnlineTime,
                RecentScreenshot = recentScreenshot,
                /*
                RecentScreenshot = recentScreenshot != null ? $"/screenshots/{Path.GetFileName(recentScreenshot)}" : null,
                */
                TopApps = formattedTopApps
            });

            /*employeeSummaries.Add(new ProjectEmployeeSummaryDto
            {
                EmployeeId = employee.Id,
                EmployeeName = employee.FullName,
                RecentScreenshot = recentScreenshot,
                /*
                RecentScreenshot = recentScreenshot != null ? $"/screenshots/{Path.GetFileName(recentScreenshot)}" : null,
                #1#
                TopApps = formattedTopApps
            });*/
        }

        return employeeSummaries;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error fetching project employees summary for project {ProjectId}", projectId);
        throw;
    }
}

    public async Task<IEnumerable<User>> GetEmployeesByProjectIdAsync(string projectId)
    {
        try
        {
            var employees = await _dbContext.Users
                .Where(u => u.ProjectEmployees.Any(pe => pe.ProjectId == projectId))
                .AsNoTracking() // Optional: improves performance if no updates are needed
                .ToListAsync();

            if (employees == null || !employees.Any())
            {
                _logger.LogWarning($"No employees found for project {projectId}.");
            }
            else
            {
                _logger.LogInformation($"Retrieved {employees.Count} employees for project {projectId}.");
            }
            return employees;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving employees for project {projectId}: {ex.Message}");
            return new List<User>();
        }
    }


    // ✅ Get project by ID
    public async Task<Project?> GetProjectByIdAsync(string projectId)
    {
        try
        {
            return await _dbContext.Projects
                .Include(p => p.ProjectEmployees)
                .FirstOrDefaultAsync(p => p.Id == projectId);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving project {projectId}: {ex.Message}");
            return null;
        }
    }

    // ✅ Get all projects
    public async Task<IEnumerable<Project>> GetAllProjectsAsync()
    {
        try
        {
            return await _dbContext.Projects.Include(p => p.ProjectEmployees).ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving all projects: {ex.Message}");
            return new List<Project>();
        }
    }

    // ✅ Get projects assigned to a specific employee
    public async Task<IEnumerable<Project>> GetProjectsByEmployeeIdAsync(string employeeId)
    {
        try
        {
            return await _dbContext.ProjectEmployees
                .Where(pe => pe.EmployeeId == employeeId)
                .Include(pe => pe.Project)
                .Select(pe => pe.Project)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving projects for employee {employeeId}: {ex.Message}");
            return new List<Project>();
        }
    }

    // ✅ Create a new project (Admin only)
    public async Task<bool> CreateProjectAsync(Project project)
    {
        try
        {
            _dbContext.Projects.Add(project);
            await _dbContext.SaveChangesAsync();
            _logger.LogInformation($"Project {project.Id} created successfully.");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error creating project {project.Id}: {ex.Message}");
            return false;
        }
    }

    // ✅ Delete a project (Admin only)
    public async Task<bool> DeleteProjectAsync(string projectId)
    {
        try
        {
            var project = await _dbContext.Projects.FindAsync(projectId);
            if (project == null)
            {
                _logger.LogWarning($"Project {projectId} not found.");
                return false;
            }

            _dbContext.Projects.Remove(project);
            await _dbContext.SaveChangesAsync();
            _logger.LogInformation($"Project {projectId} deleted successfully.");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error deleting project {projectId}: {ex.Message}");
            return false;
        }
    }

    // ✅ Add an employee to a project
    public async Task<bool> AddEmployeeToProjectAsync(string projectId, string employeeId)
    {
        try
        {
            var project = await _dbContext.Projects.FindAsync(projectId);
            var employee = await _dbContext.Users.FindAsync(employeeId);

            if (project == null || employee == null)
            {
                _logger.LogWarning($"Project or Employee not found. ProjectId: {projectId}, EmployeeId: {employeeId}");
                return false;
            }

            var existingAssignment = await _dbContext.ProjectEmployees
                .FirstOrDefaultAsync(pe => pe.ProjectId == projectId && pe.EmployeeId == employeeId);

            if (existingAssignment != null)
            {
                _logger.LogWarning($"Employee {employeeId} is already assigned to project {projectId}.");
                return false;
            }

            var newAssignment = new ProjectEmployee
            {
                Id = Guid.NewGuid().ToString(),
                ProjectId = projectId,
                EmployeeId = employeeId,
                TotalActiveTime = TimeSpan.Zero
            };

            _dbContext.ProjectEmployees.Add(newAssignment);
            await _dbContext.SaveChangesAsync();
            _logger.LogInformation($"Employee {employeeId} added to project {projectId}.");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error adding employee {employeeId} to project {projectId}: {ex.Message}");
            return false;
        }
    }

    // ✅ Remove an employee from a project
    public async Task<bool> RemoveEmployeeFromProjectAsync(string projectId, string employeeId)
    {
        try
        {
            var assignment = await _dbContext.ProjectEmployees
                .FirstOrDefaultAsync(pe => pe.ProjectId == projectId && pe.EmployeeId == employeeId);

            if (assignment == null)
            {
                _logger.LogWarning($"No assignment found for Employee {employeeId} in Project {projectId}.");
                return false;
            }

            _dbContext.ProjectEmployees.Remove(assignment);
            await _dbContext.SaveChangesAsync();
            _logger.LogInformation($"Employee {employeeId} removed from project {projectId}.");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error removing employee {employeeId} from project {projectId}: {ex.Message}");
            return false;
        }
    }
}
