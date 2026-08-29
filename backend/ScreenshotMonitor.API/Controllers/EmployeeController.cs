using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ScreenshotMonitor.Data.Dto.Authentication;
using ScreenshotMonitor.Data.Entities.Mapper;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Repositories.Interfaces;

[Route("api/employee")]
[ApiController]
public class EmployeeController(
    IAuthRepository authRepository,
    ILogger<EmployeeController> logger
) : ControllerBase
{ 
    private string GetEmployeeIdFromClaims()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new UnauthorizedAccessException("Employee ID not found in claims.");
    }
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterUserDto user)
    {
        var employee = user.ToUserEntity("Employee"); // Convert DTO to User entity
        var token = await authRepository.RegisterEmployee(employee);
        if (token == null)
            return BadRequest("Failed to register employee.");

        return Ok(new { Token = token });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
    {
        // Authenticate the user and get AuthResult
        var result = await authRepository.LoginEmployee(loginDto.Email, loginDto.Password);
        if (result == null)
            return Unauthorized("Invalid credentials.");

        // Return Token and UserId
        return Ok(new 
        { 
            Token = result.Token,
            UserId = result.UserId
        });
    }

    // New Route: Get Logged In User Id
    [HttpGet("current-user-id")]
    [Authorize] // Requires user to be authenticated
    public IActionResult GetCurrentUserId()
    {
        try
        {
            var userId = GetEmployeeIdFromClaims();
            return Ok(new { UserId = userId });
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex.Message);
            return Unauthorized(ex.Message);
        }
    }
}
