using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Dto.Dashboard;
using ScreenshotMonitor.Data.Interfaces;

namespace ScreenshotMonitor.Data.Repositories;

public class DashboardRepository(
    IConfiguration conf,
    SmDbContext dbContext,
    ILogger<AdminRepository> logger
) : IDashboardRepository
{
    public async Task<DashboardStatsDto> GetDashboardStatisticsAsync()
    {
        try
        {
            var totalProjects = await dbContext.Projects.CountAsync();
            var totalEmployees = await dbContext.Users.CountAsync(u => u.Role == "Employee");
            var totalSessions = await dbContext.Sessions.CountAsync();
            var totalScreenshots = await dbContext.Screenshots.CountAsync();
            var totalForegroundApps = await dbContext.SessionForegroundApps.CountAsync();
            var totalBackgroundApps = await dbContext.SessionBackgroundApps.CountAsync();

            var activeSessions = await dbContext.Sessions.CountAsync(s => s.Status == "Active");
            var inactiveSessions = totalSessions - activeSessions;

            var mostUsedForegroundApp = dbContext.SessionForegroundApps
                .AsEnumerable()  // Fetch data into memory first
                .GroupBy(a => a.AppName)
                .Select(g => new 
                { 
                    AppName = g.Key, 
                    TotalUsage = g.Sum(a => a.TotalUsageTime.Ticks) 
                })
                .OrderByDescending(g => g.TotalUsage)
                .FirstOrDefault()?.AppName ?? "N/A";

            var mostUsedBackgroundApp = dbContext.SessionBackgroundApps
                .AsEnumerable()  // Fetch data into memory first
                .GroupBy(a => a.AppName)
                .Select(g => new 
                { 
                    AppName = g.Key, 
                    TotalUsage = g.Sum(a => a.TotalUsageTime.Ticks) 
                })
                .OrderByDescending(g => g.TotalUsage)
                .FirstOrDefault()?.AppName ?? "N/A";



            return new DashboardStatsDto
            {
                TotalProjects = totalProjects,
                TotalEmployees = totalEmployees,
                TotalSessions = totalSessions,
                ActiveSessions = activeSessions,
                InactiveSessions = inactiveSessions,
                TotalScreenshots = totalScreenshots,
                TotalForegroundApps = totalForegroundApps,
                TotalBackgroundApps = totalBackgroundApps,
                MostUsedForegroundApp = mostUsedForegroundApp,
                MostUsedBackgroundApp = mostUsedBackgroundApp
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error fetching dashboard statistics.");
            throw;
        }
    }
}