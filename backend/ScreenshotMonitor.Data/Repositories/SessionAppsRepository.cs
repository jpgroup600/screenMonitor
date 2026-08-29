using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Interfaces.Repositories;

public class SessionAppsRepository(
    SmDbContext dbContext,
    ILogger<SessionAppsRepository> logger
) : ISessionAppsRepository
    {
        private readonly SmDbContext _dbContext = dbContext;
        private readonly ILogger<SessionAppsRepository> _logger = logger;
    


    private async Task<string?> GetActiveSessionId(string employeeId)
    {
        try
        {
            var sessionId = await _dbContext.Sessions
                .Where(s => s.EmployeeId == employeeId && s.Status == "Active")
                .OrderByDescending(s => s.StartTime) // Get latest session
                .Select(s => s.Id)
                .FirstOrDefaultAsync();

            if (sessionId == null)
            {
                _logger.LogWarning("No active session found for Employee {EmployeeId}", employeeId);
                return null;
            }

            return sessionId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error finding active session for Employee {EmployeeId}", employeeId);
            return null;
        }
    }

    public async Task<bool> StartForegroundAppAsync(string appName, string employeeId)
    {
        try
        {
            var sessionId = await GetActiveSessionId(employeeId);
            if (sessionId == null) return false;

            // Deactivate all active apps for the session
            var activeApps = await _dbContext.SessionForegroundApps
                .Where(a => a.SessionId == sessionId && a.Status == "Active")
                .ToListAsync();

            foreach (var app in activeApps)
            {
                app.Status = "Inactive";
                app.EndTime = DateTime.UtcNow;
                app.TotalUsageTime = app.EndTime.Value - app.StartTime;
            }

            // Create a new foreground app entry
            var newApp = new SessionForegroundApp
            {
                Id = Guid.NewGuid().ToString(),
                SessionId = sessionId,
                AppName = appName,
                Status = "Active",
                StartTime = DateTime.UtcNow
            };

            _dbContext.SessionForegroundApps.Add(newApp);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Started new foreground app '{AppName}' in Active Session {SessionId} for Employee {EmployeeId}", appName, sessionId, employeeId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting foreground app '{AppName}' for Employee {EmployeeId}", appName, employeeId);
            return false;
        }
    }

    public async Task<bool> EndForegroundAppAsync(string appName, string employeeId)
    {
        try
        {
            var sessionId = await GetActiveSessionId(employeeId);
            if (sessionId == null) return false;

            // Find the active app with the given name
            var app = await _dbContext.SessionForegroundApps
                .Where(a => a.SessionId == sessionId && a.AppName == appName && a.Status == "Active")
                .FirstOrDefaultAsync();

            if (app == null)
            {
                _logger.LogWarning("No active foreground app '{AppName}' found in Active Session {SessionId} for Employee {EmployeeId}", appName, sessionId, employeeId);
                return false;
            }

            // Mark as inactive and set end time
            app.Status = "Inactive";
            app.EndTime = DateTime.UtcNow;
            app.TotalUsageTime = app.EndTime.Value - app.StartTime;

            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Ended foreground app '{AppName}' in Active Session {SessionId} for Employee {EmployeeId}", appName, sessionId, employeeId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending foreground app '{AppName}' for Employee {EmployeeId}", appName, employeeId);
            return false;
        }
    }
    public async Task<List<SessionForegroundApp>> GetAllForegroundAppsAsync()
    {
        try
        {
            var apps = await _dbContext.SessionForegroundApps.ToListAsync();
        
            if (!apps.Any())
            {
                _logger.LogWarning("No foreground apps found in the database.");
                return new List<SessionForegroundApp>();
            }

            _logger.LogInformation("Retrieved {Count} foreground apps from the database.", apps.Count);
            return apps;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving all foreground apps.");
            throw;
        }
    }

    public async Task<List<SessionForegroundApp>> GetAllForegroundAppsBySessionAsync(string sessionId)
    {
        try
        {
            var apps = await _dbContext.SessionForegroundApps
                .Where(a => a.SessionId == sessionId)
                .ToListAsync();

            if (!apps.Any())
            {
                _logger.LogWarning("No foreground apps found for Session {SessionId}.", sessionId);
                return new List<SessionForegroundApp>();
            }

            _logger.LogInformation("Retrieved {Count} foreground apps for Session {SessionId}.", apps.Count, sessionId);
            return apps;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving foreground apps for Session {SessionId}.", sessionId);
            throw;
        }
    }

}
