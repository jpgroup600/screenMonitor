using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Interfaces.Repositories;

namespace ScreenshotMonitor.Data.Repositories;

public class SessionRepository(
    IConfiguration conf,
    SmDbContext dbContext,
    ILogger<SessionRepository> logger
) : ISessionRepository
{
    private readonly SmDbContext _dbContext = dbContext;
    private readonly ILogger<SessionRepository> _logger = logger;
    public async Task<List<string>> GetActiveEmployeeIdsAsync()
    {
        var activeEmployeeIds = await _dbContext.Sessions
            .Where(s => s.Status == "Active")
            .Select(s => s.EmployeeId)
            .Distinct()
            .ToListAsync();

        if (!activeEmployeeIds.Any())
        {
            _logger.LogWarning("No employees with active sessions found.");
        }

        return activeEmployeeIds;
    }
    public async Task<bool> DeleteSessionsByEmployeeInProjectAsync(string employeeId, string projectId)
    {
        try
        {
            _logger.LogInformation("Deleting sessions for Employee ID: {EmployeeId} in Project ID: {ProjectId}", employeeId, projectId);

            var sessions = await _dbContext.Sessions
                .Where(s => s.EmployeeId == employeeId && s.ProjectId == projectId)
                .Include(s => s.Screenshots)
                .Include(s => s.ForegroundApps)
                .Include(s => s.BackgroundApps)
                .ToListAsync();

            if (sessions == null || !sessions.Any())
            {
                _logger.LogWarning("No sessions found for Employee ID: {EmployeeId} in Project ID: {ProjectId}", employeeId, projectId);
                return false;
            }

            foreach (var session in sessions)
            {
                _logger.LogInformation("Deleting session ID: {SessionId} in Project ID: {ProjectId}", session.Id, projectId);

                _dbContext.Screenshots.RemoveRange(session.Screenshots);
                _dbContext.SessionForegroundApps.RemoveRange(session.ForegroundApps);
                _dbContext.SessionBackgroundApps.RemoveRange(session.BackgroundApps);
            
                _dbContext.Sessions.Remove(session);
            }

            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Successfully deleted sessions for Employee ID: {EmployeeId} in Project ID: {ProjectId}", employeeId, projectId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting sessions for Employee ID: {EmployeeId} in Project ID: {ProjectId}", employeeId, projectId);
            return false;
        }
    }

    public async Task<bool> DeleteAllSessionsByEmployeeIdAsync(string employeeId)
    {
        try
        {
            _logger.LogInformation("Deleting all sessions for Employee ID: {EmployeeId}", employeeId);

            var sessions = await _dbContext.Sessions
                .Where(s => s.EmployeeId == employeeId)
                .Include(s => s.Screenshots)
                .Include(s => s.ForegroundApps)
                .Include(s => s.BackgroundApps)
                .ToListAsync();

            if (sessions == null || !sessions.Any())
            {
                _logger.LogWarning("No sessions found for Employee ID: {EmployeeId}", employeeId);
                return false;
            }

            foreach (var session in sessions)
            {
                _logger.LogInformation("Deleting session ID: {SessionId}", session.Id);

                _dbContext.Screenshots.RemoveRange(session.Screenshots);
                _dbContext.SessionForegroundApps.RemoveRange(session.ForegroundApps);
                _dbContext.SessionBackgroundApps.RemoveRange(session.BackgroundApps);

                _dbContext.Sessions.Remove(session);
            }

            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Successfully deleted all sessions for Employee ID: {EmployeeId}", employeeId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting sessions for Employee ID: {EmployeeId}", employeeId);
            return false;
        }
    }

    public async Task<Session?> StartSessionAsync(string employeeId, string projectId)
    {
        try
        {
            // 🔍 Check for an existing active session
            var existingSession = await _dbContext.Sessions
                .Where(s => s.EmployeeId == employeeId && s.Status == "Active")
                .FirstOrDefaultAsync();

            if (existingSession != null)
            {
                _logger.LogInformation("Auto-ending previous session for Employee {EmployeeId} before starting a new one.", employeeId);
                await EndSessionAsync(employeeId, existingSession.ProjectId);
            }

            // ✅ Start a new session after ending the previous one
            var session = new Session
            {
                Id = Guid.NewGuid().ToString(),
                EmployeeId = employeeId,
                ProjectId = projectId,
                StartTime = DateTime.UtcNow,
                ActiveDuration = TimeSpan.Zero,
                Status = "Active"
            };

            await _dbContext.Sessions.AddAsync(session);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Session started for Employee {EmployeeId} on Project {ProjectId}", employeeId, projectId);
            return session;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting session for Employee {EmployeeId} on Project {ProjectId}", employeeId, projectId);
            throw;
        }
    }
    public async Task<string> EndSessionAutoOnDisconnectAsync(string employeeId, string status)
    {
        try
        {
            var activeSessions = await _dbContext.Sessions
                .Where(s => s.EmployeeId == employeeId && s.Status == status)
                .ToListAsync();

            if (!activeSessions.Any())
            {
                _logger.LogWarning("No active sessions found for Employee {EmployeeId} with Status {Status}", employeeId, status);
                return "No active sessions found."; // Indicate no sessions were ended
            }

            foreach (var session in activeSessions)
            {
                await EndSessionAsync(employeeId, session.ProjectId);
            }

            _logger.LogInformation("Successfully ended all active sessions for Employee {EmployeeId}", employeeId);
            return "Successfully ended all active sessions.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending active sessions for Employee {EmployeeId} with Status {Status}", employeeId, status);
            return "An error occurred while ending sessions."; // Return an error message
        }
    }
    
    public async Task<bool> EndSessionAsync(string employeeId, string projectId)
    {
        try
        {
            var session = await _dbContext.Sessions
                .Where(s => s.EmployeeId == employeeId && s.ProjectId == projectId && s.Status == "Active")
                .OrderByDescending(s => s.StartTime)
                .FirstOrDefaultAsync();

            if (session == null)
            {
                _logger.LogWarning("No active session found for Employee {EmployeeId} on Project {ProjectId}", employeeId, projectId);
                return false;
            }

            // ** Step 1: Find and End Active Foreground Apps **
            var activeApps = await _dbContext.SessionForegroundApps
                .Where(a => a.SessionId == session.Id && a.Status == "Active")
                .ToListAsync();

            foreach (var app in activeApps)
            {
                app.Status = "Inactive";
                app.EndTime = DateTime.UtcNow;
                app.TotalUsageTime = app.EndTime.Value - app.StartTime;
            }

            // ** Step 2: End the Session **
            session.EndTime = DateTime.UtcNow;
            session.ActiveDuration = session.EndTime.Value - session.StartTime;
            session.Status = "Complete";

            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Session and all active foreground apps ended for Employee {EmployeeId} on Project {ProjectId}", employeeId, projectId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending session for Employee {EmployeeId} on Project {ProjectId}", employeeId, projectId);
            throw;
        }
    }


    public async Task<IEnumerable<Session>> GetSessionsByStatusAsync(string employeeId, string projectId, string status = null)
    {
        try
        {
            var query = _dbContext.Sessions
                .Where(s => s.EmployeeId == employeeId && s.ProjectId == projectId);

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(s => s.Status == status);
            }

            return await query.OrderByDescending(s => s.StartTime).ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching sessions for Employee {EmployeeId} on Project {ProjectId} with Status {Status}", employeeId, projectId, status);
            throw;
        }
    }


    public async Task<bool> DeleteSessionsAsync(string employeeId, string projectId)
    {
        try
        {
            var sessions = await _dbContext.Sessions
                .Where(s => s.EmployeeId == employeeId && s.ProjectId == projectId)
                .ToListAsync();

            if (!sessions.Any())
            {
                _logger.LogWarning("No sessions found for deletion for Employee {EmployeeId} on Project {ProjectId}", employeeId, projectId);
                return false;
            }

            _dbContext.Sessions.RemoveRange(sessions);
            await _dbContext.SaveChangesAsync();

            _logger.LogInformation("Deleted all sessions for Employee {EmployeeId} on Project {ProjectId}", employeeId, projectId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting sessions for Employee {EmployeeId} on Project {ProjectId}", employeeId, projectId);
            throw;
        }
    }
}

