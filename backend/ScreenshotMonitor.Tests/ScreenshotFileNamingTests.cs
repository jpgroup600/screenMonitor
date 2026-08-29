using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class ScreenshotFileNamingTests
{
    [Fact]
    public void Creates_unique_names_for_simultaneous_monitor_captures()
    {
        var capturedAt = new DateTime(2026, 8, 30, 0, 0, 0, DateTimeKind.Utc);
        var first = ScreenshotFileNaming.Create("session-1", ".png", capturedAt, Guid.NewGuid());
        var second = ScreenshotFileNaming.Create("session-1", ".png", capturedAt, Guid.NewGuid());

        Assert.NotEqual(first, second);
        Assert.StartsWith("session-1_20260830000000000_", first);
        Assert.EndsWith(".png", first);
    }
}
