using System;
using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace ScreenshotMonitor.Data.Services;

public record AgentExitGrant(string Token, string AdminId, string DeviceId, string Reason, DateTime ExpiresAt);

public class AgentExitGrantService(TimeProvider timeProvider)
{
    private readonly ConcurrentDictionary<string, AgentExitGrant> grants = new();
    private static string Key(string token) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));

    public AgentExitGrant Issue(string adminId, string deviceId, string reason)
    {
        if (string.IsNullOrWhiteSpace(deviceId)) throw new ArgumentException("Device ID is required.");
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 3) throw new ArgumentException("An exit reason of at least 3 characters is required.");
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var grant = new AgentExitGrant(token, adminId, deviceId.Trim(), reason.Trim(), timeProvider.GetUtcNow().UtcDateTime.AddMinutes(2));
        grants[Key(token)] = grant;
        return grant;
    }

    public AgentExitGrant? Consume(string token, string deviceId)
    {
        if (string.IsNullOrWhiteSpace(token) || !grants.TryRemove(Key(token), out var grant)) return null;
        if (grant.ExpiresAt < timeProvider.GetUtcNow().UtcDateTime || grant.DeviceId != deviceId) return null;
        return grant;
    }
}
