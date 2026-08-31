using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public record InventoryEntry(string Path, long SizeBytes, long? ModifiedUnixSeconds, bool RequiresBackup = true);
public record InventoryProgress(string RunId, string Status, int Total, int Pending, int BackedUp, int Failed, int Excluded, int Unchanged,
    bool BackupRequested, long DiscoveredFiles, long DiscoveredBytes, long SkippedEntries, long InaccessibleEntries, string CurrentPath, DateTime? LastProgressAt);
public record InventoryFolder(string Path, string Name, string? ParentPath, int Depth, int FileCount, long SizeBytes, int Pending, int BackedUp, int Failed, int Excluded, int Unchanged);

public class BackupInventoryService(SmDbContext db, TimeProvider timeProvider)
{
    public static readonly TimeSpan StaleScanningTimeout = TimeSpan.FromHours(2);

    public async Task<BackupInventoryRun> StartAsync(string employeeId, string deviceId)
    {
        if (string.IsNullOrWhiteSpace(deviceId)) throw new ArgumentException("DeviceId is required.");
        var run = new BackupInventoryRun { EmployeeId = employeeId, DeviceId = deviceId, StartedAt = timeProvider.GetUtcNow().UtcDateTime };
        db.BackupInventoryRuns.Add(run); await db.SaveChangesAsync(); return run;
    }

    public async Task<int> AddBatchAsync(string runId, string employeeId, IEnumerable<InventoryEntry> entries)
    {
        var run = await db.BackupInventoryRuns.FirstOrDefaultAsync(x => x.Id == runId && x.EmployeeId == employeeId && x.Status == "Scanning")
            ?? throw new InvalidOperationException("Active inventory run was not found.");
        var batch = entries.Take(500).Where(x => !string.IsNullOrWhiteSpace(x.Path) && x.SizeBytes >= 0).ToList();
        var paths = batch.Select(x => x.Path).ToList();
        var existing = (await db.BackupInventoryItems.Where(x => x.RunId == runId && paths.Contains(x.Path)).Select(x => x.Path).ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var rules = await db.BackupPathRules.AsNoTracking().Where(x => x.DeviceId == run.DeviceId).ToListAsync();
        var added = batch.Where(x => existing.Add(x.Path)).Select(x => {
            var rule = rules.Where(rule => IsWithin(x.Path, rule.Path)).OrderByDescending(rule => rule.Path.Length).FirstOrDefault();
            var status = !x.RequiresBackup ? "Unchanged" : rule?.Action == "Exclude" ? "Excluded" : "Pending";
            return new BackupInventoryItem {
                Run = run, Path = x.Path, SizeBytes = x.SizeBytes, ModifiedUnixSeconds = x.ModifiedUnixSeconds,
                RequiresBackup = x.RequiresBackup, Status = status, DiscoveredAt = now
            };
        }).ToList();
        db.BackupInventoryItems.AddRange(added); await db.SaveChangesAsync(); return added.Count;
    }

    public async Task<bool> CompleteInventoryAsync(string runId, string employeeId)
    {
        var run = await db.BackupInventoryRuns.FirstOrDefaultAsync(x => x.Id == runId && x.EmployeeId == employeeId && x.Status == "Scanning");
        if (run is null) return false;
        run.Status = run.BackupRequested ? "BackingUp" : "InventoryReady"; run.InventoryCompletedAt = timeProvider.GetUtcNow().UtcDateTime;
        await ApplyRulesAsync(run);
        if (run.BackupRequested && !await db.BackupInventoryItems.AnyAsync(x => x.RunId == run.Id && x.Status == "Pending"))
        {
            run.Status = "Completed";
            run.BackupCompletedAt = timeProvider.GetUtcNow().UtcDateTime;
        }
        await db.SaveChangesAsync(); return true;
    }

    public async Task<BackupPathRule> SetRuleAsync(string deviceId, string path, string action)
    {
        if (action is not ("Include" or "Exclude")) throw new ArgumentException("Action must be Include or Exclude.");
        path = path.Trim().TrimEnd('\\', '/');
        if (string.IsNullOrWhiteSpace(path)) throw new ArgumentException("Path is required.");
        var rule = await db.BackupPathRules.FirstOrDefaultAsync(x => x.DeviceId == deviceId && x.Path == path);
        if (rule is null) { rule = new BackupPathRule { DeviceId = deviceId, Path = path }; db.BackupPathRules.Add(rule); }
        rule.Action = action; rule.CreatedAt = timeProvider.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync();
        foreach (var run in await db.BackupInventoryRuns.Where(x => x.DeviceId == deviceId && (x.Status == "InventoryReady" || x.Status == "BackingUp")).ToListAsync())
            await ApplyRulesAsync(run);
        await db.SaveChangesAsync(); return rule;
    }

    public async Task<int> SetRulesAsync(string deviceId, IEnumerable<string> paths, string action)
    {
        if (action is not ("Include" or "Exclude")) throw new ArgumentException("Action must be Include or Exclude.");
        if (string.IsNullOrWhiteSpace(deviceId)) throw new ArgumentException("DeviceId is required.");
        var normalizedPaths = paths.Select(x => x?.Trim().TrimEnd('\\', '/'))
            .Where(x => !string.IsNullOrWhiteSpace(x)).Cast<string>().Distinct(StringComparer.OrdinalIgnoreCase).Take(500).ToList();
        if (normalizedPaths.Count == 0) throw new ArgumentException("At least one path is required.");
        var existing = await db.BackupPathRules.Where(x => x.DeviceId == deviceId && normalizedPaths.Contains(x.Path)).ToListAsync();
        var now = timeProvider.GetUtcNow().UtcDateTime;
        foreach (var path in normalizedPaths)
        {
            var rule = existing.FirstOrDefault(x => x.Path.Equals(path, StringComparison.OrdinalIgnoreCase));
            if (rule is null) { rule = new BackupPathRule { DeviceId = deviceId, Path = path }; db.BackupPathRules.Add(rule); }
            rule.Action = action; rule.CreatedAt = now;
        }
        await db.SaveChangesAsync();
        foreach (var run in await db.BackupInventoryRuns.Where(x => x.DeviceId == deviceId && (x.Status == "InventoryReady" || x.Status == "BackingUp")).ToListAsync())
            await ApplyRulesAsync(run);
        await db.SaveChangesAsync();
        return normalizedPaths.Count;
    }

    public async Task<bool> StartBackupAsync(string runId)
    {
        var run = await db.BackupInventoryRuns.FirstOrDefaultAsync(x => x.Id == runId && (x.Status == "Scanning" || x.Status == "InventoryReady"));
        if (run is null) return false;
        run.BackupRequested = true;
        await ApplyRulesAsync(run);
        if (run.Status == "Scanning") { await db.SaveChangesAsync(); return true; }
        if (await db.BackupInventoryItems.AnyAsync(x => x.RunId == runId && x.Status == "Pending")) run.Status = "BackingUp";
        else { run.Status = "Completed"; run.BackupCompletedAt = timeProvider.GetUtcNow().UtcDateTime; }
        await db.SaveChangesAsync(); return true;
    }

    public async Task<bool> UpdateProgressAsync(string runId, string employeeId, long discoveredFiles, long discoveredBytes,
        long skippedEntries, long inaccessibleEntries, string currentPath)
    {
        var run = await db.BackupInventoryRuns.FirstOrDefaultAsync(x => x.Id == runId && x.EmployeeId == employeeId && x.Status == "Scanning");
        if (run is null) return false;
        run.DiscoveredFiles = Math.Max(run.DiscoveredFiles, discoveredFiles);
        run.DiscoveredBytes = Math.Max(run.DiscoveredBytes, discoveredBytes);
        run.SkippedEntries = Math.Max(run.SkippedEntries, skippedEntries);
        run.InaccessibleEntries = Math.Max(run.InaccessibleEntries, inaccessibleEntries);
        run.CurrentPath = (currentPath ?? string.Empty).Length > 2048 ? currentPath[..2048] : currentPath ?? string.Empty;
        run.LastProgressAt = timeProvider.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(); return true;
    }

    public async Task<InventoryProgress?> ProgressAsync(string runId)
    {
        var run = await db.BackupInventoryRuns.AsNoTracking().FirstOrDefaultAsync(x => x.Id == runId);
        if (run is null) return null;
        var statuses = await db.BackupInventoryItems.Where(x => x.RunId == runId).GroupBy(x => x.Status)
            .Select(x => new { Status = x.Key, Count = x.Count() }).ToDictionaryAsync(x => x.Status, x => x.Count);
        int Count(string status) => statuses.GetValueOrDefault(status);
        return new(run.Id, run.Status, statuses.Values.Sum(), Count("Pending"), Count("BackedUp"), Count("Failed"), Count("Excluded"), Count("Unchanged"),
            run.BackupRequested, run.DiscoveredFiles, run.DiscoveredBytes, run.SkippedEntries, run.InaccessibleEntries, run.CurrentPath, run.LastProgressAt);
    }

    public Task<List<BackupInventoryRun>> ListRunsAsync(int take = 50) => db.BackupInventoryRuns.AsNoTracking().Include(x => x.Employee)
        .OrderByDescending(x => x.StartedAt).Take(Math.Clamp(take, 1, 200)).ToListAsync();

    public async Task<List<BackupInventoryItem>> ListItemsAsync(string runId, string? search, string? status, int skip = 0, int take = 200)
    {
        var query = db.BackupInventoryItems.AsNoTracking().Where(x => x.RunId == runId);
        if (!string.IsNullOrWhiteSpace(search)) { var keyword = search.Trim().ToLower(); query = query.Where(x => x.Path.ToLower().Contains(keyword)); }
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        return await query.OrderBy(x => x.Path).Skip(Math.Max(skip, 0)).Take(Math.Clamp(take, 1, 500)).ToListAsync();
    }

    public async Task<List<InventoryFolder>> ListFoldersAsync(string runId, string? search, int skip = 0, int take = 100)
    {
        var files = await db.BackupInventoryItems.AsNoTracking().Where(x => x.RunId == runId)
            .Select(x => new { x.Path, x.SizeBytes, x.Status }).ToListAsync();
        var folders = AggregateFolders(files.Select(x => (x.Path, x.SizeBytes, x.Status)));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            folders = folders.Where(x => x.Path.Contains(keyword, StringComparison.OrdinalIgnoreCase)
                || x.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase)).ToList();
        }
        return folders.OrderBy(x => x.Path).Skip(Math.Max(skip, 0)).Take(Math.Clamp(take, 1, 500)).ToList();
    }

    internal static List<InventoryFolder> AggregateFolders(IEnumerable<(string Path, long SizeBytes, string Status)> files)
    {
        var totals = new Dictionary<string, (int Files, long Bytes, int Pending, int BackedUp, int Failed, int Excluded, int Unchanged)>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in files)
        {
            foreach (var folder in ParentFolders(file.Path))
            {
                var value = totals.GetValueOrDefault(folder);
                value.Files++;
                value.Bytes += file.SizeBytes;
                if (file.Status == "Pending") value.Pending++;
                else if (file.Status == "BackedUp") value.BackedUp++;
                else if (file.Status == "Failed") value.Failed++;
                else if (file.Status == "Excluded") value.Excluded++;
                else if (file.Status == "Unchanged") value.Unchanged++;
                totals[folder] = value;
            }
        }
        return totals.Select(pair => {
            var path = pair.Key;
            var parent = ParentFolder(path);
            var name = path.EndsWith(":\\", StringComparison.Ordinal) ? path : path[(path.LastIndexOf('\\') + 1)..];
            var depth = path.EndsWith(":\\", StringComparison.Ordinal) ? 0 : path.Count(character => character == '\\');
            var value = pair.Value;
            return new InventoryFolder(path, name, parent, depth, value.Files, value.Bytes, value.Pending, value.BackedUp, value.Failed, value.Excluded, value.Unchanged);
        }).ToList();
    }

    private static IEnumerable<string> ParentFolders(string filePath)
    {
        var current = ParentFolder(filePath);
        while (current is not null)
        {
            yield return current;
            current = ParentFolder(current);
        }
    }

    private static string? ParentFolder(string path)
    {
        var normalized = path.Replace('/', '\\').TrimEnd('\\');
        if (normalized.Length == 2 && normalized[1] == ':') return null;
        var separator = normalized.LastIndexOf('\\');
        if (separator < 0) return null;
        if (separator == 2 && normalized[1] == ':') return normalized[..3];
        return separator == 0 ? "\\" : normalized[..separator];
    }

    public Task<List<BackupPathRule>> ListRulesAsync(string deviceId) => db.BackupPathRules.AsNoTracking()
        .Where(x => x.DeviceId == deviceId).OrderByDescending(x => x.Path.Length).ToListAsync();

    public async Task<BackupPathRule?> RemoveRuleAsync(string ruleId)
    {
        var rule = await db.BackupPathRules.FirstOrDefaultAsync(x => x.Id == ruleId);
        if (rule is null) return null;
        db.BackupPathRules.Remove(rule);
        await db.SaveChangesAsync();
        foreach (var run in await db.BackupInventoryRuns.Where(x => x.DeviceId == rule.DeviceId
            && (x.Status == "InventoryReady" || x.Status == "BackingUp")).ToListAsync())
            await ApplyRulesAsync(run);
        await db.SaveChangesAsync();
        return rule;
    }

    public async Task<BackupInventoryRun?> ActiveRunAsync(string employeeId, string deviceId)
    {
        var cutoff = timeProvider.GetUtcNow().UtcDateTime - StaleScanningTimeout;
        var stale = await db.BackupInventoryRuns.Where(x => x.EmployeeId == employeeId && x.DeviceId == deviceId
            && x.Status == "Scanning" && (x.LastProgressAt ?? x.StartedAt) < cutoff).ToListAsync();
        if (stale.Count > 0)
        {
            foreach (var run in stale) run.Status = "Abandoned";
            await db.SaveChangesAsync();
        }
        return await db.BackupInventoryRuns.AsNoTracking()
            .Where(x => x.EmployeeId == employeeId && x.DeviceId == deviceId
                && (x.Status == "Scanning" || x.Status == "InventoryReady" || x.Status == "BackingUp"))
            .OrderByDescending(x => x.StartedAt).FirstOrDefaultAsync();
    }

    public Task<List<BackupInventoryItem>> PendingItemsAsync(string runId, string employeeId, string deviceId, int take = 3) =>
        db.BackupInventoryItems.AsNoTracking().Where(x => x.RunId == runId && x.Run.EmployeeId == employeeId
            && x.Run.DeviceId == deviceId && x.Run.BackupRequested && x.Status == "Pending")
        .OrderBy(x => x.Path).Take(Math.Clamp(take, 1, 20)).ToListAsync();

    public async Task<bool> RecordResultAsync(string itemId, string employeeId, string deviceId, bool succeeded, string? error)
    {
        var item = await db.BackupInventoryItems.Include(x => x.Run).FirstOrDefaultAsync(x => x.Id == itemId
            && x.Run.EmployeeId == employeeId && x.Run.DeviceId == deviceId && x.Run.BackupRequested && x.Status == "Pending");
        if (item is null) return false;
        item.Status = succeeded ? "BackedUp" : "Failed"; item.Error = succeeded ? null : error;
        item.BackedUpAt = succeeded ? timeProvider.GetUtcNow().UtcDateTime : null;
        await db.SaveChangesAsync();
        if (item.Run.Status != "Scanning" && !await db.BackupInventoryItems.AnyAsync(x => x.RunId == item.RunId && x.Status == "Pending"))
        {
            item.Run.Status = "Completed"; item.Run.BackupCompletedAt = timeProvider.GetUtcNow().UtcDateTime; await db.SaveChangesAsync();
        }
        return true;
    }

    private async Task ApplyRulesAsync(BackupInventoryRun run)
    {
        var rules = await db.BackupPathRules.Where(x => x.DeviceId == run.DeviceId).ToListAsync();
        if (rules.Count == 0) return;
        var items = await db.BackupInventoryItems.Where(x => x.RunId == run.Id).ToListAsync();
        foreach (var item in items)
        {
            if (item.Status is not ("Pending" or "Excluded")) continue;
            var rule = rules.Where(x => IsWithin(item.Path, x.Path)).OrderByDescending(x => x.Path.Length).FirstOrDefault();
            item.Status = rule?.Action == "Exclude" ? "Excluded" : "Pending";
        }
    }

    internal static bool IsWithin(string path, string rulePath)
    {
        var normalizedPath = path.Replace('/', '\\').TrimEnd('\\');
        var normalizedRule = rulePath.Replace('/', '\\').TrimEnd('\\');
        return normalizedPath.Equals(normalizedRule, StringComparison.OrdinalIgnoreCase)
            || normalizedPath.StartsWith(normalizedRule + "\\", StringComparison.OrdinalIgnoreCase);
    }
}
