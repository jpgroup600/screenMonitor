using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Interfaces;

namespace ScreenshotMonitor.API.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Roles = "Admin")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardRepository _dashboardRepository;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(IDashboardRepository dashboardRepository, ILogger<DashboardController> logger)
    {
        _dashboardRepository = dashboardRepository;
        _logger = logger;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetDashboardStatistics()
    {
        try
        {
            var stats = await _dashboardRepository.GetDashboardStatisticsAsync();
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching dashboard statistics.");
            return StatusCode(500, "An error occurred while fetching dashboard statistics.");
        }
    }
}
