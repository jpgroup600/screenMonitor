using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto.Attendance;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Controllers;

[ApiController]
[Authorize(Roles = "Employee,Admin")]
[Route("api/attendance")]
public class AttendanceController(AttendanceService attendanceService) : ControllerBase
{
    private string EmployeeId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? throw new UnauthorizedAccessException("Employee ID not found in claims.");

    [HttpGet("current")]
    public async Task<ActionResult<AttendanceResponseDto>> Current()
    {
        var record = await attendanceService.GetCurrentAsync(EmployeeId);
        return record is null ? NoContent() : Ok(ToResponse(record));
    }

    [HttpPost("clock-in")]
    public async Task<ActionResult<AttendanceResponseDto>> ClockIn()
    {
        var record = await attendanceService.ClockInAsync(EmployeeId);
        return Ok(ToResponse(record));
    }

    [HttpPost("clock-out")]
    public async Task<ActionResult<AttendanceResponseDto>> ClockOut()
    {
        var record = await attendanceService.ClockOutAsync(EmployeeId);
        if (record is null) return NotFound(new { message = "No active attendance record." });
        return Ok(ToResponse(record));
    }

    [HttpPost("idle")]
    public async Task<IActionResult> Idle([FromBody] IdleEventRequestDto request)
    {
        try
        {
            var recorded = await attendanceService.RecordIdleAsync(EmployeeId, request.Event);
            return recorded ? NoContent() : NotFound(new { message = "No active attendance record." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<AttendanceResponseDto>>> History([FromQuery] int take = 30)
    {
        var records = await attendanceService.HistoryAsync(EmployeeId, take);
        return Ok(records.Select(ToResponse));
    }

    private static AttendanceResponseDto ToResponse(AttendanceRecord record) => new(
        record.Id, record.ClockInAt, record.ClockOutAt, record.TotalIdleDuration, record.Status);

}
