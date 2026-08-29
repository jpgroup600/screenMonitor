using System.Collections.Generic;
using System.Threading.Tasks;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Interfaces.Repositories;

public interface ISessionAppsRepository
{
    Task<bool> StartForegroundAppAsync(string appName, string employeeId);
    Task<bool> EndForegroundAppAsync(string appName, string employeeId);
    Task<List<SessionForegroundApp>> GetAllForegroundAppsAsync();
    Task<List<SessionForegroundApp>> GetAllForegroundAppsBySessionAsync(string sessionId);
}
