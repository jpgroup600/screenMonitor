using System.Threading.Tasks;
using ScreenshotMonitor.Data.Dto.Dashboard;

namespace ScreenshotMonitor.Data.Interfaces;

public interface IDashboardRepository
{
    Task<DashboardStatsDto> GetDashboardStatisticsAsync();
}
