using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Services;

public class BackupRetentionWorker(IServiceScopeFactory scopeFactory, TimeProvider timeProvider, ILogger<BackupRetentionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception error) { logger.LogError(error, "Backup retention cycle failed"); }
            await Task.Delay(TimeSpan.FromHours(6), timeProvider, stoppingToken);
        }
    }

    internal async Task RunOnceAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SmDbContext>();
        var retention = scope.ServiceProvider.GetRequiredService<BackupRetentionService>();
        var audit = scope.ServiceProvider.GetRequiredService<AdminAuditService>();
        var policies = await db.DeviceSecurityPolicies.AsNoTracking().Where(x => x.RetentionEnabled).ToListAsync(cancellationToken);
        foreach (var policy in policies)
        {
            var result = await retention.ApplyAsync(policy.DeviceId, policy.RetentionDays, policy.MaxBackupBytes,
                policy.MaxVersionsPerFile, cancellationToken);
            if (result.DeletedVersions > 0 || result.FailedObjects > 0)
                await audit.AppendAndSaveAsync("system", "BACKUP_RETENTION_APPLIED", "Device", policy.DeviceId, null, result);
        }
        await retention.ProcessDeletionQueueAsync(cancellationToken);
    }
}
