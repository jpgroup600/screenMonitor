using ScreenshotMonitor.Data.Services;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class AgentExitGrantServiceTests
{
    [Fact]
    public void Grant_is_single_use_and_bound_to_device()
    {
        var service = new AgentExitGrantService(TimeProvider.System);
        var grant = service.Issue("admin-1", "device-1", "Maintenance");
        Assert.Null(service.Consume(grant.Token, "device-2"));
        Assert.Null(service.Consume(grant.Token, "device-1"));

        grant = service.Issue("admin-1", "device-1", "Maintenance");
        Assert.NotNull(service.Consume(grant.Token, "device-1"));
        Assert.Null(service.Consume(grant.Token, "device-1"));
    }

    [Fact]
    public void Reason_is_required()
    {
        var service = new AgentExitGrantService(TimeProvider.System);
        Assert.Throws<ArgumentException>(() => service.Issue("admin-1", "device-1", " "));
    }
}
