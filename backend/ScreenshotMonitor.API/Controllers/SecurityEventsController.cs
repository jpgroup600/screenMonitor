using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto.Security;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Controllers;

[ApiController, Authorize, Route("api/security-events")]
public class SecurityEventsController(SecurityEventService service) : ControllerBase
{
    private string EmployeeId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new UnauthorizedAccessException();
    [Authorize(Roles = "Employee,Admin"), HttpPost]
    public async Task<ActionResult<SecurityEventResponseDto>> Record(SecurityEventRequestDto request)
    {
        try { return Ok(ToResponse(await service.RecordAsync(EmployeeId, request.DeviceId, request.EventType, request.Source, request.Details))); }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
    }
    [Authorize(Roles = "Admin"), HttpGet]
    public async Task<ActionResult<IEnumerable<SecurityEventResponseDto>>> List([FromQuery] int take = 200) => Ok((await service.ListAsync(take)).Select(ToResponse));
    private static SecurityEventResponseDto ToResponse(ScreenshotMonitor.Data.Entities.SecurityEvent value) => new(value.Id, value.EmployeeId, value.Employee?.FullName ?? "", value.DeviceId, value.EventType, value.Source, value.Severity, value.Details, value.OccurredAt);
}
