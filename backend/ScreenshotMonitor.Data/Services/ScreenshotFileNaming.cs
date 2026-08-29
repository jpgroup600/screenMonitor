using System;

namespace ScreenshotMonitor.Data.Services;

public static class ScreenshotFileNaming
{
    public static string Create(string sessionId, string extension, DateTime capturedAt, Guid uniqueId) =>
        $"{sessionId}_{capturedAt:yyyyMMddHHmmssfff}_{uniqueId:N}{extension}";
}
