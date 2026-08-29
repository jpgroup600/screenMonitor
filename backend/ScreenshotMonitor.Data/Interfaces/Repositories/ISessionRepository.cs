using System.Collections.Generic;
using System.Threading.Tasks;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Interfaces.Repositories;

public interface ISessionRepository
{
    Task<bool> DeleteSessionsByEmployeeInProjectAsync(string employeeId, string projectId);
    Task<List<string>> GetActiveEmployeeIdsAsync();
    Task<bool> DeleteAllSessionsByEmployeeIdAsync(string employeeId);
    Task<Session> StartSessionAsync(string employeeId, string projectId);
    Task<bool> EndSessionAsync(string employeeId, string projectId);
    Task<string?> EndSessionAutoOnDisconnectAsync(string employeeId, string status);

    Task<IEnumerable<Session>> GetSessionsByStatusAsync(string employeeId, string projectId,string status = null);
    Task<bool> DeleteSessionsAsync(string employeeId, string projectId);
}
