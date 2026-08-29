using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto.Device;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Controllers;

[ApiController, Authorize, Route("api/devices")]
public class DeviceController(DeviceService service) : ControllerBase
{
    private string EmployeeId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new UnauthorizedAccessException();

    [Authorize(Roles = "Employee,Admin"), HttpPost("heartbeat")]
    public async Task<ActionResult<DeviceResponseDto>> Heartbeat(DeviceHeartbeatRequestDto request)
    {
        try { return Ok(ToResponse(await service.HeartbeatAsync(EmployeeId, request.DeviceId, request.Name, request.OperatingSystem))); }
        catch (UnauthorizedAccessException) { return StatusCode(StatusCodes.Status403Forbidden, new { message = "Device is blocked." }); }
    }

    [Authorize(Roles = "Admin"), HttpGet]
    public async Task<ActionResult<IEnumerable<DeviceResponseDto>>> List() => Ok((await service.ListAsync()).Select(ToResponse));

    [Authorize(Roles = "Admin"), HttpPut("{deviceId}/status")]
    public async Task<IActionResult> SetStatus(string deviceId, DeviceStatusRequestDto request)
    {
        try { return await service.SetStatusAsync(deviceId, request.Status) ? NoContent() : NotFound(); }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
    }

    private static DeviceResponseDto ToResponse(ScreenshotMonitor.Data.Entities.Device device) => new(device.Id, device.EmployeeId, device.Employee?.FullName ?? "", device.Name, device.OperatingSystem, device.RegisteredAt, device.LastSeenAt, device.Status);
}
