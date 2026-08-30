using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Services;

public sealed class AttendanceAutoCloseWorker(IServiceScopeFactory scopeFactory, TimeProvider timeProvider, ILogger<AttendanceAutoCloseWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<AttendanceService>();
                var cutoff = AttendanceService.LatestSeoulFourAmCutoff(timeProvider.GetUtcNow());
                var count = await service.AutoCloseBeforeAsync(cutoff);
                if (count > 0) logger.LogInformation("Automatically closed {Count} attendance records at {Cutoff} UTC", count, cutoff);
            }
            catch (Exception error) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(error, "Attendance automatic close failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
