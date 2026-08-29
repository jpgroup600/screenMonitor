using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Repositories;
using Xunit;

namespace ScreenshotMonitor.Tests;

public class SessionRepositoryTests
{
    [Fact]
    public async Task Employee_query_includes_general_and_project_sessions_newest_first()
    {
        await using var db = CreateDb();
        db.Sessions.AddRange(
            new Session { Id = "project", EmployeeId = "employee-1", ProjectId = "project-1", StartTime = new DateTime(2026, 8, 29, 1, 0, 0, DateTimeKind.Utc), Status = "Complete" },
            new Session { Id = "general", EmployeeId = "employee-1", ProjectId = null, StartTime = new DateTime(2026, 8, 29, 2, 0, 0, DateTimeKind.Utc), Status = "Active" },
            new Session { Id = "other", EmployeeId = "employee-2", ProjectId = null, StartTime = new DateTime(2026, 8, 29, 3, 0, 0, DateTimeKind.Utc), Status = "Active" });
        await db.SaveChangesAsync();
        var repository = new SessionRepository(
            new ConfigurationBuilder().Build(),
            db,
            NullLogger<SessionRepository>.Instance);

        var sessions = (await repository.GetSessionsByEmployeeAsync("employee-1")).ToList();

        Assert.Equal(new[] { "general", "project" }, sessions.Select(x => x.Id));
        Assert.Null(sessions[0].ProjectId);
    }

    private static SmDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<SmDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new SmDbContext(options);
    }
}
