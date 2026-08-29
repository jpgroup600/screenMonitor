using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto.Project;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Entities.Mapper;
using ScreenshotMonitor.Data.Interfaces.Repositories;

namespace ScreenshotMonitor.API.Controllers;

[Route("api/project")]
[ApiController]
public class ProjectController(
    IProjectRepository projectRepo,
    ILogger<ProjectController> logger
) : ControllerBase
{
    [Authorize(Roles = "Admin")]
    // ✅ Set Screenshot Interval (POST)
    [HttpPost("{projectId}/employee/{employeeId}/screenshot-interval")]
    public async Task<IActionResult> SetScreenshotInterval(string projectId, string employeeId, [FromBody] ScreenshotIntervalRequest request)
    {
        var interval = request.GetTimeSpan();

        if (interval == null)
        {
            return BadRequest("Invalid time format. Use 'hh:mm:ss' or 'c' format.");
        }

        var result = await projectRepo.SetScreenshotIntervalAsync(projectId, employeeId, interval);
        if (result)
        {
            return Ok(new { Message = "Screenshot interval updated successfully" });
        }
        return NotFound(new { Message = "ProjectEmployee not found" });
    }
    
    // ✅ Get Screenshot Interval (GET)
    [HttpGet("{projectId}/employee/{employeeId}/screenshot-interval")]
    [Authorize(Roles = "Admin,Employee" )]
    public async Task<IActionResult> GetScreenshotInterval(string projectId, string employeeId)
    {
        var interval = await projectRepo.GetScreenshotIntervalAsync(projectId, employeeId);
        if (interval != null)
        {
            return Ok(new { ScreenshotInterval = interval });
        }
        return NotFound(new { Message = "Screenshot interval not found" });
    }
    
    [Authorize(Roles = "Admin")]
    [HttpGet("employees/{projectId}/summary")]
    public async Task<IActionResult> GetProjectEmployeesSummary(string projectId)
    {
        var result = await projectRepo.GetProjectEmployeesSummaryAsync(projectId);
        return Ok(result);
    }

    // Get Employees by ProjectId
    [HttpGet("employees/{projectId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetProjectEmployees( string projectId)
    {
        try
        {
            logger.LogInformation("Fetching project employees");
            var employees = await projectRepo.GetEmployeesByProjectIdAsync(projectId);
            return Ok(employees);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching employees");
            return StatusCode(500, "An error occurred while fetching employees.");
        }
    }
    // ✅ Get all projects
    [HttpGet("all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllProjects()
    {
        try
        {
            logger.LogInformation("Fetching all projects...");
            var projects = await projectRepo.GetAllProjectsAsync();
            return Ok(projects.Select(ProjectMapper.ToDto));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching projects");
            return StatusCode(500, "An error occurred while fetching projects.");
        }
    }

    // ✅ Get a project by ID
    [HttpGet("{projectId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetProjectById(string projectId)
    {
        try
        {
            logger.LogInformation($"Fetching project with ID: {projectId}");
            var project = await projectRepo.GetProjectByIdAsync(projectId);
            if (project == null)
            {
                logger.LogWarning($"Project {projectId} not found.");
                return NotFound($"Project {projectId} not found.");
            }

            return Ok(ProjectMapper.ToDto(project));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, $"Error retrieving project {projectId}");
            return StatusCode(500, "An error occurred while retrieving the project.");
        }
    }

   
    // ✅ Create a new project
    [HttpPost("")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateProject([FromBody] CreateProjectDto createProjectDto)
    {
        try
        {
            var adminId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(adminId))
            {
                logger.LogWarning("Unauthorized attempt to create a project. No valid admin ID found in token.");
                return Unauthorized("Admin ID not found in token.");
            }

            var project = new Project
            {
                Id = Guid.NewGuid().ToString(),
                Name = createProjectDto.Name,
                Description = createProjectDto.Description,
                AdminId = adminId, // Automatically set from token
                CreatedAt = DateTime.UtcNow,
                EndDate = createProjectDto.EndDate,
                Status = createProjectDto.Status ?? "Active"
            };

            var success = await projectRepo.CreateProjectAsync(project);
            if (!success)
            {
                logger.LogError($"Failed to create project: {project.Name}");
                return StatusCode(500, "Failed to create project.");
            }

            logger.LogInformation($"Project {project.Id} created successfully by Admin {adminId}");
            return CreatedAtAction(nameof(GetProjectById), new { projectId = project.Id }, ProjectMapper.ToDto(project));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while creating the project.");
            return StatusCode(500, "An error occurred while creating the project.");
        }
    }


    // ✅ Delete a project
    [HttpDelete("{projectId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteProject(string projectId)
    {
        try
        {
            var adminId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(adminId))
            {
                logger.LogWarning("Unauthorized attempt to delete a project. No valid admin ID found in token.");
                return Unauthorized("Admin ID not found in token.");
            }

            var project = await projectRepo.GetProjectByIdAsync(projectId);
            if (project == null)
            {
                logger.LogWarning($"Project {projectId} not found.");
                return NotFound("Project not found.");
            }

            if (project.AdminId != adminId)
            {
                logger.LogWarning($"Admin {adminId} attempted to delete project {projectId} without ownership.");
                return Forbid("You are not authorized to delete this project.");
            }

            var success = await projectRepo.DeleteProjectAsync(projectId);
            if (!success)
            {
                logger.LogError($"Failed to delete project {projectId}.");
                return StatusCode(500, "Failed to delete project.");
            }

            logger.LogInformation($"Project {projectId} deleted successfully by Admin {adminId}");
            return NoContent();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, $"An error occurred while deleting project {projectId}");
            return StatusCode(500, "An error occurred while deleting the project.");
        }
    }


    // ✅ Add an employee to a project
    [HttpPost("{projectId}/{employeeId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddEmployeeToProject(string projectId, string employeeId)
    {
        

        try
        {
            logger.LogInformation($"Assigning employee {employeeId} to project {projectId}");
            var success = await projectRepo.AddEmployeeToProjectAsync(projectId, employeeId);

            if (!success)
            {
                logger.LogWarning($"Project {projectId} or Employee {employeeId} not found.");
                return NotFound("Project or employee not found.");
            }

            logger.LogInformation($"Employee {employeeId} successfully added to project {projectId}");
            return Ok("Employee added.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, $"Error assigning employee {employeeId} to project {projectId}");
            return StatusCode(500, "An error occurred while assigning the employee.");
        }
    }

    // ✅ Remove an employee from a project
    [HttpDelete("{projectId}/employee/{employeeId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveEmployeeFromProject(string projectId, string employeeId)
    {
        try
        {
            logger.LogInformation($"Removing employee {employeeId} from project {projectId}");
            var success = await projectRepo.RemoveEmployeeFromProjectAsync(projectId, employeeId);

            if (!success)
            {
                logger.LogWarning($"Employee {employeeId} or project {projectId} not found.");
                return NotFound("Project or employee not found.");
            }

            logger.LogInformation($"Employee {employeeId} successfully removed from project {projectId}");
            return Ok("Employee removed.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, $"Error removing employee {employeeId} from project {projectId}");
            return StatusCode(500, "An error occurred while removing the employee.");
        }
    }
    // ✅ Get projects assigned to a specific employee
    [HttpGet("employee/{employeeId}/project")]
    [Authorize(Roles = "Employee,Admin")]
    
    public async Task<IActionResult> GetProjectsByEmployeeId(string employeeId)
    {
        try
        {
            logger.LogInformation($"Fetching projects for employee {employeeId}");
            var projects = await projectRepo.GetProjectsByEmployeeIdAsync(employeeId);

            if (projects == null || !projects.Any())
            {
                logger.LogWarning($"No projects found for employee {employeeId}");
                return NotFound($"No projects found for employee {employeeId}");
            }

            return Ok(projects.Select(ProjectMapper.ToDto));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, $"Error retrieving projects for employee {employeeId}");
            return StatusCode(500, "An error occurred while retrieving projects.");
        }
    }

}
