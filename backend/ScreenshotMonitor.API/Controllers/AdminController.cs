using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ScreenshotMonitor.Data.Dto.Authentication;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Repositories.Interfaces;
using ScreenshotMonitor.Data.Entities.Mapper;
using Microsoft.AspNetCore.Authorization;
using ScreenshotMonitor.Data.Interfaces.Repositories;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Build.Framework;

[Route("api/admin")]
[ApiController]
public class AdminController(
    IAuthRepository authRepository,
    IAdminRepository adminRepo,
    ILogger<AdminController> logger
) : ControllerBase
{
    
    [HttpGet("debug-claims")]
    public IActionResult DebugClaims()
    {
        var claims = User.Claims.Select(c => new { c.Type, c.Value }).ToList();
        return Ok(claims);
    }
    
    private string GetCurrentUsersIdFromClaims()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new UnauthorizedAccessException("Employee ID not found in claims.");
    }
    
    [HttpGet("user/{userId}/projects-apps-info")]
    public async Task<IActionResult> GetUserWithProjectsAndTopApps(string userId)
    {
        try
        {
            var userSummary = await adminRepo.GetUserWithProjectsAndTopAppsAsync(userId);
            
            if (userSummary == null)
            {
                logger.LogWarning("User with ID {UserId} not found", userId);
                return NotFound(new { message = "User not found" });
            }

            return Ok(userSummary);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching user details for UserId {UserId}", userId);
            return StatusCode(500, new { message = "An error occurred while processing the request" });
        }
    }
    
    // For Employee to update any USERS PROFILE.
    [Authorize(Roles = "Admin")]
    [HttpPatch("update-profile/{userId}")]
    public async Task<IActionResult> EditUserProfile(string userId, [FromBody] UpdateUserProfileDto updateDto)
    {
        var success = await adminRepo.EditUserProfileAsync(userId, updateDto);
        if (!success)
        {
            return BadRequest("Update failed. Ensure at least one valid value is provided.");
        }

        return Ok("Profile updated successfully.");
    }
    
    // For Employee OR Admin to update their own password.
    [Authorize(Roles = "Employee,Admin")]
    [HttpPut("change-own-password")]
    public async Task<IActionResult> ChangeOwnPassword( [FromBody] ChangePasswordDto changeDto)
    {
        var success = await adminRepo.ChangeOwnPasswordAsync(GetCurrentUsersIdFromClaims(), changeDto.OldPassword, changeDto.NewPassword);
        if (!success)
        {
            return BadRequest("Password update failed. Incorrect old password or other error.");
        }

        return Ok("Password updated successfully.");
    }
    
    // For admin to reset any user's password.
    [Authorize(Roles = "Admin")]
    [HttpPut("reset-password/{userId}")]
    public async Task<IActionResult> ResetUserPassword(string userId,[FromBody] ResetPasswordDto resetDto)
    {
        var success = await adminRepo.ResetUserPasswordAsync(GetCurrentUsersIdFromClaims(), userId, resetDto.NewPassword);
        if (!success)
        {
            return BadRequest("Password reset failed.");
        }

        return Ok("Password reset successfully.");
    }

    
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterUserDto user)
    {
        var admin = user.ToUserEntity("Admin"); // Convert DTO to User entity
        var token = await authRepository.RegisterAdmin(admin);
        if (token == null)
            return BadRequest("Failed to register admin.");

        return Ok(new { Token = token });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
    {
        var token = await authRepository.LoginAdmin(loginDto.Email, loginDto.Password);
        if (token == null)
            return Unauthorized("Invalid credentials.");

        return Ok(new { Token = token });
    }

    [HttpGet("all-users")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllUsers()
    {
        try
        {
            if (HttpContext.User.Identity is not ClaimsIdentity identity)
            {
                logger.LogWarning("Unauthorized access attempt: User identity is not a ClaimsIdentity.");
                return BadRequest("Invalid user identity.");
            }

            var claims = identity.Claims;
            var userId = claims.FirstOrDefault(x => x.Type == ClaimTypes.NameIdentifier)?.Value;

            logger.LogInformation($"User {userId} is attempting to fetch all users.");

            var users = await adminRepo.GetAllUsersAsync();

            if (users.Count == 0)
            {
                logger.LogWarning("No users found in the database.");
                return NotFound("No users found.");
            }

            logger.LogInformation($"Successfully retrieved {users.Count} users.");
            return Ok(users);
        }
        catch (Exception e)
        {
            logger.LogError(e, "An error occurred while fetching users.");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }


    [HttpGet("only-admins")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminsOnly()
    {
        var admins = await adminRepo.GetAdminsOnlyAsync();
        return admins.Count > 0 ? Ok(admins) : NotFound("No admins found.");
    }
    
    [HttpGet("only-employees")]
    [Authorize(Roles = "Employee, Admin")]
    public async Task<IActionResult> GetEmployeesOnly()
    {
        /*
        var employees = await adminRepo.GetEmployeesOnlyAsync();
        */
        var employees = await adminRepo.UpdateTotalOnlineTimeAndGetAllEmployeesAsync();
        return employees.Count > 0 ? Ok(employees) : NotFound("No employees found.");
    }

    [HttpGet("user/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetUserById(string userId)
    {
        var user = await adminRepo.GetUserByIdAsync(userId);
        return user != null ? Ok(user) : NotFound($"User with ID {userId} not found.");
    }

    [HttpDelete("user/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUser(Guid userId)
    {
        var success = await adminRepo.DeleteUserAsync(userId);
        return success ? Ok($"User {userId} deleted successfully.")
                       : NotFound($"User {userId} not found or deletion failed.");
    }
}
