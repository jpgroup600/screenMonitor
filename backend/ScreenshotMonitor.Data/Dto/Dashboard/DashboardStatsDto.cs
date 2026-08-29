namespace ScreenshotMonitor.Data.Dto.Dashboard;

public class DashboardStatsDto
{
    public int TotalProjects { get; set; }
    public int TotalEmployees { get; set; }
    public int TotalSessions { get; set; }
    public int ActiveSessions { get; set; }
    public int InactiveSessions { get; set; }
    public int TotalScreenshots { get; set; }
    public int TotalForegroundApps { get; set; }
    public int TotalBackgroundApps { get; set; }
    public string MostUsedForegroundApp { get; set; }
    public string MostUsedBackgroundApp { get; set; }
}
