using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public class BackupRestoreService(SmDbContext db, TimeProvider timeProvider)
{
    public async Task<BackupRestoreRequest?> RequestAsync(string fileVersionId)
    {
        var version = await db.FileVersions.Include(x => x.BackupFile).FirstOrDefaultAsync(x => x.Id == fileVersionId);
        if (version is null) return null;
        var existing = await db.BackupRestoreRequests.FirstOrDefaultAsync(x => x.FileVersionId == fileVersionId && x.Status == "Pending");
        if (existing is not null) return existing;
        var request = new BackupRestoreRequest {
            FileVersionId = version.Id, EmployeeId = version.BackupFile.EmployeeId,
            DeviceId = version.BackupFile.DeviceId, OriginalPath = version.BackupFile.OriginalPath,
            RequestedAt = timeProvider.GetUtcNow().UtcDateTime
        };
        db.BackupRestoreRequests.Add(request);
        await db.SaveChangesAsync();
        return request;
    }

    public Task<List<BackupRestoreRequest>> PendingAsync(string employeeId, string deviceId) => db.BackupRestoreRequests
        .AsNoTracking().Where(x => x.EmployeeId == employeeId && x.DeviceId == deviceId && x.Status == "Pending")
        .OrderBy(x => x.RequestedAt).ToListAsync();

    public Task<BackupRestoreRequest?> GetPendingAsync(string id, string employeeId, string deviceId) => db.BackupRestoreRequests
        .AsNoTracking().Include(x => x.FileVersion)
        .FirstOrDefaultAsync(x => x.Id == id && x.EmployeeId == employeeId && x.DeviceId == deviceId && x.Status == "Pending");

    public async Task<bool> CompleteAsync(string id, string employeeId, string deviceId, bool succeeded, string? resultPath, string? error)
    {
        var request = await db.BackupRestoreRequests.FirstOrDefaultAsync(x => x.Id == id && x.EmployeeId == employeeId && x.DeviceId == deviceId && x.Status == "Pending");
        if (request is null) return false;
        request.Status = succeeded ? "Completed" : "Failed";
        request.ResultPath = succeeded ? resultPath : null;
        request.Error = succeeded ? null : error;
        request.CompletedAt = timeProvider.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync();
        return true;
    }
}
