using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Services;

public class AdminAuditService(SmDbContext db, TimeProvider timeProvider)
{
    public async Task AppendAsync(string adminId, string action, string targetType, string targetId, object? before, object? after)
    {
        var occurredAt = timeProvider.GetUtcNow().UtcDateTime;
        var beforeJson = Serialize(before);
        var afterJson = Serialize(after);
        var previous = await db.AdminAuditLogs.OrderByDescending(x => x.Sequence)
            .Select(x => new { x.Sequence, x.EntryHash }).FirstOrDefaultAsync();
        var previousHash = previous?.EntryHash ?? new string('0', 64);
        db.AdminAuditLogs.Add(new AdminAuditLog {
            Sequence = (previous?.Sequence ?? 0) + 1,
            AdminId = adminId,
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            BeforeJson = beforeJson,
            AfterJson = afterJson,
            PreviousHash = previousHash,
            EntryHash = ComputeHash(previousHash, occurredAt, adminId, action, targetType, targetId, beforeJson, afterJson),
            OccurredAt = occurredAt
        });
    }

    public async Task AppendAndSaveAsync(string adminId, string action, string targetType, string targetId, object? before, object? after)
    {
        await AppendAsync(adminId, action, targetType, targetId, before, after);
        await db.SaveChangesAsync();
    }

    public Task<List<AdminAuditLog>> ListAsync(int take = 200) => db.AdminAuditLogs.AsNoTracking()
        .OrderByDescending(x => x.Sequence).Take(Math.Clamp(take, 1, 500)).ToListAsync();

    public async Task<bool> VerifyChainAsync()
    {
        var entries = await db.AdminAuditLogs.AsNoTracking().OrderBy(x => x.Sequence).ToListAsync();
        var previousHash = new string('0', 64);
        foreach (var entry in entries)
        {
            if (entry.PreviousHash != previousHash || entry.EntryHash != ComputeHash(previousHash, entry.OccurredAt,
                entry.AdminId, entry.Action, entry.TargetType, entry.TargetId, entry.BeforeJson, entry.AfterJson)) return false;
            previousHash = entry.EntryHash;
        }
        return true;
    }

    private static string Serialize(object? value) => value is string text ? text : JsonSerializer.Serialize(value ?? new { });

    private static string ComputeHash(string previousHash, DateTime occurredAt, string adminId, string action,
        string targetType, string targetId, string before, string after)
    {
        var canonical = string.Join("|", previousHash, occurredAt.ToUniversalTime().ToString("O"), adminId, action,
            targetType, targetId, before, after);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }
}
