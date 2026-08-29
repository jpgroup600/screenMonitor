using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto.Project;
using ScreenshotMonitor.Data.Interfaces.Repositories;

namespace ScreenshotMonitor.API.Controllers;


[ApiController]
[Route("api/sessionForegroundApp")]
public class SessionForegroundAppController : ControllerBase
{
    private readonly ISessionAppsRepository _repository;
    private readonly ILogger<SessionForegroundAppController> _logger;

    public SessionForegroundAppController(ISessionAppsRepository repository, ILogger<SessionForegroundAppController> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    private string GetEmployeeIdFromClaims()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new UnauthorizedAccessException("Employee ID not found in claims.");
    }
    [HttpPost("start")]
    [Authorize(Roles = "Employee")]
    public async Task<IActionResult> StartForegroundApp([FromBody] AppNameDto appNameDto)
    {
        try
        {
            var employeeId = GetEmployeeIdFromClaims();
            var result = await _repository.StartForegroundAppAsync(appNameDto.AppName, employeeId);
            return result ? Ok("Foreground app started successfully.") : BadRequest("Failed to start foreground app.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting foreground app '{AppName}'", appNameDto.AppName);
            return StatusCode(500, "An error occurred while starting the foreground app.");
        }
    }

    [HttpPost("end")]
    [Authorize(Roles = "Employee")]
    public async Task<IActionResult> EndForegroundApp([FromBody] AppNameDto appNameDto)
    {
        try
        {
            var employeeId = GetEmployeeIdFromClaims();
            var result = await _repository.EndForegroundAppAsync(appNameDto.AppName, employeeId);
            return result ? Ok("Foreground app ended successfully.") : BadRequest("Failed to end foreground app.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending foreground app '{AppName}'", appNameDto.AppName);
            return StatusCode(500, "An error occurred while ending the foreground app.");
        }
    }
    

    [HttpGet("all")]
    [Authorize(Roles = "Employee,Admin")]
    public async Task<IActionResult> GetAllForegroundApps()
    {
        try
        {
            var apps = await _repository.GetAllForegroundAppsAsync();
            return Ok(apps);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving all foreground apps.");
            return StatusCode(500, "An error occurred while fetching the foreground apps.");
        }
    }

    [HttpGet("session/{sessionId}")] 
    [Authorize(Roles = "Employee,Admin")]
    public async Task<IActionResult> GetAllForegroundAppsBySession(string sessionId)
    {
        try
        {
            var apps = await _repository.GetAllForegroundAppsBySessionAsync(sessionId);
            return Ok(apps);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving foreground apps for Session {SessionId}.", sessionId);
            return StatusCode(500, "An error occurred while fetching foreground apps for the session.");
        }
    }
}
