using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Internal;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Dto.Project;
using ScreenshotMonitor.Data.Dto.Screenshot;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Interfaces.Repositories;

namespace ScreenshotMonitor.Data.Repositories;

public class ScreenshotRepository(
    IConfiguration conf,
    SmDbContext dbContext,
    ILogger<ScreenshotRepository> logger,
    IConfiguration configuration
) : IScreenshotRepository
{
    private readonly SmDbContext _dbContext = dbContext;
    private readonly ILogger<ScreenshotRepository> _logger = logger;
    /*
    private readonly string _storagePath = conf["ScreenshotStoragePath"] ?? "Screenshots";
    */
    /*
    private readonly string _storagePath = @"C:\\Users\\ahsan\\Desktop\\ScreenshotMonitor LocalStorage\\screenshots";
    */
    // Set different paths for Windows and Linux
    
    private readonly string _storagePath = configuration["FileStorage:UploadPath"] ?? "/var/www/Uploads/";
    //private readonly string _storagePath =configuration["FileStorage:WindowsUploadPath"] ?? @"C:\Users\ahsan\Desktop\ScreenshotMonitor LocalStorage\screenshots";
    
    public async Task<List<EmployeeScreenshotDto>> GetRecentScreenshotsAsync(List<string> employeeIds)
    {
        _logger.LogInformation("Fetching most recent screenshots for {Count} employees.", employeeIds.Count);

        var screenshotsList = new List<EmployeeScreenshotDto>();

        foreach (var employeeId in employeeIds)
        {
            var employee = await _dbContext.Users
                .Where(u => u.Id == employeeId)
                .Select(u => new { u.Id, u.FullName })
                .FirstOrDefaultAsync();

            if (employee == null)
            {
                _logger.LogWarning("Employee with ID {EmployeeId} not found.", employeeId);
                continue;
            }
            
            // Fetch the most recent screenshot for the employee (across all sessions)
            var recentScreenshot = await _dbContext.Screenshots
                .Where(s => s.Session.EmployeeId == employeeId)
                .OrderByDescending(s => s.CapturedAt)
                .Select(s => new { s.FilePath, s.CapturedAt })
                .FirstOrDefaultAsync();

            if (recentScreenshot == null)
            {
                _logger.LogWarning("No screenshots found for Employee {EmployeeId}.", employeeId);
                continue;
            }

// Convert the relative file path to an absolute path
            string absoluteFilePath = Path.Combine(_storagePath, Path.GetFileName(recentScreenshot.FilePath));

            _logger.LogInformation("Most recent screenshot for Employee {EmployeeId} is located at {FilePath}.", employeeId, absoluteFilePath);

            screenshotsList.Add(new EmployeeScreenshotDto
            {
                EmployeeId = employee.Id,
                EmployeeName = employee.FullName,
                ImageFilePath = absoluteFilePath,
                TimeTaken = recentScreenshot.CapturedAt
            });

            _logger.LogInformation("Recent screenshot found for Employee {EmployeeId} - File: {FilePath}", 
                employeeId, recentScreenshot.FilePath);
        }

        return screenshotsList;
    }

    
public async Task<bool> UploadScreenshotDuringSessionAsync(string employeeId, IFormFile image)
{
    _logger.LogInformation(_storagePath + "UploadScreenshotDuringSession");
    try
    {
        var session = await _dbContext.Sessions
            .Where(s => s.EmployeeId == employeeId && s.Status == "Active")
            .OrderByDescending(s => s.StartTime)
            .FirstOrDefaultAsync();

        if (session == null)
        {
            _logger.LogWarning("No active session found for Employee {EmployeeId}, screenshot upload failed.", employeeId);
            return false;
        }

        if (image == null || image.Length == 0)
        {
            _logger.LogWarning("Invalid image file received for Employee {EmployeeId}.", employeeId);
            return false;
        }

        var allowedExtensions = new HashSet<string> { ".png", ".jpg", ".jpeg" };
        var fileExtension = Path.GetExtension(image.FileName).ToLowerInvariant();

        if (!allowedExtensions.Contains(fileExtension))
        {
            _logger.LogWarning("Unsupported file format {Extension} for Employee {EmployeeId}. Allowed: .png, .jpg, .jpeg", fileExtension, employeeId);
            return false;
        }

        // Ensure directory exists
        Directory.CreateDirectory(_storagePath);

        string fileName = $"{session.Id}_{DateTime.UtcNow:yyyyMMddHHmmss}{fileExtension}";
        string fullPath = Path.Combine(_storagePath, fileName);

        using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await image.CopyToAsync(stream);
        }

        // Save only the relative path (not full system path)
        string relativeFilePath = $"/Uploads/{fileName}";

        var screenshot = new Screenshot
        {
            Id = Guid.NewGuid().ToString(),
            SessionId = session.Id,
            FilePath = relativeFilePath,
            CapturedAt = DateTime.UtcNow
        };

        _dbContext.Screenshots.Add(screenshot);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Screenshot uploaded successfully for Employee {EmployeeId} in Session {SessionId}.", employeeId, session.Id);
        return true;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error uploading screenshot for Employee {EmployeeId}.", employeeId);
        return false;
    }
}
public async Task<List<string>> FetchScreenshotsBySessionIdAsync(string sessionId)
{
    try
    {
        if (!Directory.Exists(_storagePath))
        {
            _logger.LogWarning("Screenshot directory does not exist at: {StoragePath}", _storagePath);
            return new List<string>();
        }

        return await Task.Run(() => 
            Directory.GetFiles(_storagePath)
                .Where(file => Path.GetFileName(file).StartsWith(sessionId) &&
                               (file.EndsWith(".png") || file.EndsWith(".jpg") || file.EndsWith(".jpeg")))
                .ToList()
        );
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error fetching screenshots for session: {SessionId}", sessionId);
        throw;
    }
}
public async Task<List<ScreenshotDto>> GetScreenshotsBySessionIdAsync(string sessionId)
{
    try
    {
        if (!Directory.Exists(_storagePath))
        {
            _logger.LogWarning("Screenshot directory does not exist at: {StoragePath}", _storagePath);
            return new List<ScreenshotDto>();
        }

        return await Task.Run(() =>
            Directory.GetFiles(_storagePath, $"{sessionId}_*.*")
                .Where(file => file.EndsWith(".png") || file.EndsWith(".jpg") || file.EndsWith(".jpeg"))
                .Select(file => new ScreenshotDto()
                {
                    FilePath = file, // Full file path
                    FileName = Path.GetFileName(file), // Extract filename only
                    CreatedAt = File.GetCreationTimeUtc(file) // Ensure UTC timestamps
                })
                .ToList()
        );
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error fetching screenshots for session: {SessionId}", sessionId);
        throw;
    }
}



// Helper method to get MIME type
    private static string GetContentType(string filePath)
    {
        var extension = Path.GetExtension(filePath).ToLowerInvariant();
    
        return extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            _ => "application/octet-stream" // Default for unknown file types
        };
    }


}
