using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto.Project;
using ScreenshotMonitor.Data.Interfaces.Repositories;

namespace ScreenshotMonitor.API.Controllers;

[ApiController]
[Route("api/screenshots")]
public class ScreenshotController(
    IScreenshotRepository screenshotRepo,
    ILogger<ScreenshotController> logger
) : ControllerBase
{
    private readonly IScreenshotRepository _screenshotRepo = screenshotRepo;
    private readonly ILogger<ScreenshotController> _logger = logger;

    private string GetEmployeeIdFromClaims()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new UnauthorizedAccessException("Employee ID not found in claims.");
    }
    
    [Authorize(Roles = "Admin")]
    [HttpPost("recent-screenshots")]
    public async Task<IActionResult> GetRecentScreenshots([FromBody] ScreenshotRequestDto request)
    {
        if (request == null || request.EmployeeIds == null || !request.EmployeeIds.Any())
        {
            _logger.LogWarning("Invalid request: Employee IDs list is empty or missing.");
            return BadRequest(new { message = "Employee IDs list cannot be empty." });
        }

        var result = await _screenshotRepo.GetRecentScreenshotsAsync(request.EmployeeIds);

        if (!result.Any())
        {
            _logger.LogInformation("No recent screenshots found for the provided employees.");
            return NotFound(new { message = "No recent screenshots found for the provided employees." });
        }

        return Ok(result);
    }


    [HttpPost("upload")]
    [Authorize(Roles = "Employee")]
    public async Task<IActionResult> UploadScreenshot(IFormFile image)
    {
        try
        {
            string employeeId = GetEmployeeIdFromClaims();
            bool success = await _screenshotRepo.UploadScreenshotDuringSessionAsync(employeeId, image);

            if (!success)
                return BadRequest("Failed to upload screenshot.");

            return Ok("Screenshot uploaded successfully.");
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex.Message);
            return Unauthorized(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading screenshot.");
            return StatusCode(500, "Internal server error.");
        }
    }
    /// <summary>
    /// Fetches all screenshots objects for a given session.
    /// </summary>
    [HttpGet("{sessionId}")]
    [Authorize(Roles = "Employee,Admin")]

    public async Task<IActionResult> GetScreenshots(string sessionId)
    {
        try
        {
            var screenshots = await _screenshotRepo.GetScreenshotsBySessionIdAsync(sessionId);
            
            if (screenshots == null || screenshots.Count == 0)
            {
                return NotFound(new { message = "No screenshots found for this session." });
            }

            return Ok(screenshots);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving screenshots for session: {SessionId}", sessionId);
            return StatusCode(500, "Internal server error.");
        }
    }

    /// <summary>
    /// Returns a single screenshot file for download.
    /// </summary>
    [HttpGet("image")]
    [Authorize(Roles = "Employee,Admin")]

    public IActionResult GetScreenshotFile([FromQuery] string filePath)
    {
        try
        {
            if (string.IsNullOrEmpty(filePath))
            {
                return BadRequest(new { message = "File path is required." });
            }

            if (!System.IO.File.Exists(filePath))
            {
                return NotFound(new { message = "File not found." });
            }

            // Get file extension and determine content type
            var fileExtension = Path.GetExtension(filePath).ToLower();
            string contentType = fileExtension switch
            {
                ".png" => "image/png",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                _ => throw new InvalidOperationException("Unsupported file format")
            };

            var fileStream = System.IO.File.OpenRead(filePath);
            return File(fileStream, contentType, Path.GetFileName(filePath));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving file: {FilePath}", filePath);
            return StatusCode(500, "Internal server error.");
        }
    }
}
