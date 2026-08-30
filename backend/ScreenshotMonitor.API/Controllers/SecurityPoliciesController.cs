using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto.Security;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Controllers;

[ApiController, Authorize, Route("api/security-policies")]
public class SecurityPoliciesController(DeviceSecurityPolicyService service) : ControllerBase
{
    private string UserId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new UnauthorizedAccessException();

    [Authorize(Roles = "Employee"), HttpGet("device/{deviceId}/effective")]
    public async Task<ActionResult<DeviceSecurityPolicyDto>> Effective(string deviceId)
    {
        try { return Ok(ToDto(await service.GetForEmployeeAsync(UserId, deviceId))); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    [Authorize(Roles = "Admin"), HttpGet("device/{deviceId}")]
    public async Task<ActionResult<DeviceSecurityPolicyDto>> Get(string deviceId)
    {
        try { return Ok(ToDto(await service.GetForAdminAsync(deviceId))); }
        catch (KeyNotFoundException) { return NotFound(); }
    }

    [Authorize(Roles = "Admin"), HttpPut("device/{deviceId}")]
    public async Task<ActionResult<DeviceSecurityPolicyDto>> Update(string deviceId, UpdateDeviceSecurityPolicyDto request)
    {
        try { return Ok(ToDto(await service.UpdateAsync(UserId, deviceId, request))); }
        catch (KeyNotFoundException) { return NotFound(); }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
    }

    [Authorize(Roles = "Admin"), HttpGet("audit")]
    public async Task<ActionResult<IEnumerable<AdminAuditLogDto>>> Audit([FromQuery] int take = 200) =>
        Ok((await service.ListAuditAsync(take)).Select(x => new AdminAuditLogDto(
            x.Id, x.Sequence, x.AdminId, x.Action, x.TargetType, x.TargetId, x.BeforeJson, x.AfterJson,
            x.PreviousHash, x.EntryHash, x.OccurredAt)));

    [Authorize(Roles = "Admin"), HttpGet("audit/integrity")]
    public async Task<ActionResult> AuditIntegrity() => Ok(new { valid = await service.VerifyAuditChainAsync() });

    private static DeviceSecurityPolicyDto ToDto(DeviceSecurityPolicy value) => new(
        value.DeviceId, value.MonitoringEnabled, value.ScreenshotsEnabled, value.ActiveAppTrackingEnabled,
        value.IdleTrackingEnabled, value.BackupEnabled, value.UsbAuditEnabled, value.UsbFileCopyAuditEnabled, value.NetworkAuditEnabled,
        value.FileChangeAuditEnabled, value.AttendanceRemindersEnabled, value.RestoreEnabled,
        value.RetentionEnabled, value.RetentionDays, value.MaxBackupBytes, value.MaxVersionsPerFile,
        value.ResourceThrottlingEnabled, value.PauseBackupOnBattery, value.PauseBackupOnMeteredNetwork,
        value.ScanThrottleMilliseconds, value.DailyUploadLimitBytes,
        value.UpdatedByAdminId, value.UpdatedAt);
}
