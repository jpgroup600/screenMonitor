using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Controllers;

[ApiController, Route("api/agent-exit")]
public class AgentExitController(AgentExitGrantService grants, AdminAuditService audit) : ControllerBase
{
    private string UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown";

    [Authorize(Roles = "Admin"), HttpPost("authorize")]
    public async Task<ActionResult<object>> Authorize(AuthorizeAgentExitDto request)
    {
        try
        {
            var grant = grants.Issue(UserId, request.DeviceId, request.Reason);
            await audit.AppendAndSaveAsync(UserId, "AGENT_EXIT_AUTHORIZED", "Device", request.DeviceId, null,
                new { grant.Reason, grant.ExpiresAt });
            return Ok(new { grant.Token, grant.ExpiresAt });
        }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
    }

    [AllowAnonymous, HttpPost("consume")]
    public async Task<IActionResult> Consume(ConsumeAgentExitDto request)
    {
        var grant = grants.Consume(request.Token, request.DeviceId);
        if (grant is null) return Unauthorized();
        await audit.AppendAndSaveAsync(grant.AdminId, "AGENT_EXITED", "Device", grant.DeviceId, null,
            new { grant.Reason });
        return NoContent();
    }
}

public record AuthorizeAgentExitDto(string DeviceId, string Reason);
public record ConsumeAgentExitDto(string DeviceId, string Token);
