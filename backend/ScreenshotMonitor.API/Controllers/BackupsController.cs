using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Controllers;

[ApiController, Authorize(Roles = "Employee,Admin"), Route("api/backups")]
public class BackupsController(BackupService service, BackupRestoreService restoreService, BackupInventoryService inventoryService, IBackupObjectStorage storage) : ControllerBase
{
    private string EmployeeId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new UnauthorizedAccessException();

    [HttpPost("upload"), RequestSizeLimit(1_200_000_000), RequestFormLimits(MultipartBodyLengthLimit = 1_200_000_000)]
    public async Task<ActionResult<BackupUploadResponseDto>> Upload(
        [FromForm] string deviceId, [FromForm] string originalPath, [FromForm] string contentHash,
        [FromForm] long plainSizeBytes, [FromForm] long sourceModifiedUnixSeconds, [FromForm] IFormFile encryptedFile,
        CancellationToken cancellationToken)
    {
        if (encryptedFile.Length == 0) return BadRequest(new { message = "Encrypted backup file is required." });
        try
        {
            await using var stream = encryptedFile.OpenReadStream();
            var sourceModifiedAt = DateTimeOffset.FromUnixTimeSeconds(sourceModifiedUnixSeconds).UtcDateTime;
            var (version, deduplicated) = await service.UploadAsync(EmployeeId, deviceId, originalPath, contentHash,
                plainSizeBytes, sourceModifiedAt, stream, encryptedFile.Length, cancellationToken);
            return Ok(new BackupUploadResponseDto(version.BackupFileId, version.Id, version.ObjectKey, deduplicated, version.UploadedAt));
        }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
    }

    [Authorize(Roles = "Admin"), HttpGet]
    public async Task<ActionResult<IEnumerable<BackupFileListDto>>> List([FromQuery] string? search = null, [FromQuery] int take = 200) =>
        Ok((await service.ListAsync(search, take)).Select(file => {
            var latest = file.Versions.OrderByDescending(version => version.UploadedAt).First();
            return new BackupFileListDto(file.Id, file.EmployeeId, file.Employee.FullName, file.DeviceId, file.OriginalPath,
                file.Versions.Count, latest.PlainSizeBytes, latest.UploadedAt);
        }));

    [Authorize(Roles = "Admin"), HttpGet("{id}")]
    public async Task<ActionResult<BackupFileDetailDto>> Detail(string id)
    {
        var file = await service.GetAsync(id);
        if (file is null) return NotFound();
        return Ok(new BackupFileDetailDto(file.Id, file.EmployeeId, file.Employee.FullName, file.DeviceId,
            file.OriginalPath, file.Versions.Select(version => new BackupVersionDto(version.Id, version.ContentHash,
                version.PlainSizeBytes, version.SourceModifiedAt, version.UploadedAt)).ToList()));
    }

    [Authorize(Roles = "Admin"), HttpPost("restore-requests")]
    public async Task<ActionResult<BackupRestoreResponseDto>> RequestRestore(BackupRestoreRequestDto request)
    {
        var restore = await restoreService.RequestAsync(request.FileVersionId);
        return restore is null ? NotFound() : Ok(ToRestoreResponse(restore));
    }

    [Authorize(Roles = "Employee,Admin"), HttpGet("restore-requests/pending")]
    public async Task<ActionResult<IEnumerable<BackupRestoreResponseDto>>> PendingRestores([FromQuery] string deviceId) =>
        Ok((await restoreService.PendingAsync(EmployeeId, deviceId)).Select(ToRestoreResponse));

    [Authorize(Roles = "Employee,Admin"), HttpGet("restore-requests/{id}/content")]
    public async Task<IActionResult> RestoreContent(string id, [FromQuery] string deviceId, CancellationToken cancellationToken)
    {
        var restore = await restoreService.GetPendingAsync(id, EmployeeId, deviceId);
        if (restore is null) return NotFound();
        return File(await storage.OpenReadAsync(restore.FileVersion.ObjectKey, cancellationToken), "application/octet-stream", "restore.smbackup");
    }

    [Authorize(Roles = "Employee,Admin"), HttpPost("restore-requests/{id}/complete")]
    public async Task<IActionResult> CompleteRestore(string id, [FromQuery] string deviceId, BackupRestoreCompleteDto result) =>
        await restoreService.CompleteAsync(id, EmployeeId, deviceId, result.Succeeded, result.ResultPath, result.Error) ? NoContent() : NotFound();

    private static BackupRestoreResponseDto ToRestoreResponse(ScreenshotMonitor.Data.Entities.BackupRestoreRequest value) =>
        new(value.Id, value.FileVersionId, value.EmployeeId, value.DeviceId, value.OriginalPath, value.Status,
            value.RequestedAt, value.CompletedAt, value.ResultPath, value.Error);

    [Authorize(Roles = "Employee,Admin"), HttpPost("inventory/runs")]
    public async Task<ActionResult<InventoryRunDto>> StartInventory(InventoryStartDto request) =>
        Ok(ToInventoryRun(await inventoryService.StartAsync(EmployeeId, request.DeviceId)));

    [Authorize(Roles = "Employee,Admin"), HttpPost("inventory/runs/{runId}/files")]
    public async Task<ActionResult<object>> AddInventoryBatch(string runId, InventoryBatchDto request) =>
        Ok(new { added = await inventoryService.AddBatchAsync(runId, EmployeeId, request.Files.Select(x => new InventoryEntry(x.Path, x.SizeBytes, x.ModifiedUnixSeconds))) });

    [Authorize(Roles = "Employee,Admin"), HttpPost("inventory/runs/{runId}/complete")]
    public async Task<IActionResult> CompleteInventory(string runId) =>
        await inventoryService.CompleteInventoryAsync(runId, EmployeeId) ? NoContent() : NotFound();

    [Authorize(Roles = "Employee,Admin"), HttpGet("inventory/device/{deviceId}/active")]
    public async Task<ActionResult<InventoryRunDto>> ActiveInventory(string deviceId)
    {
        var run = await inventoryService.ActiveRunAsync(EmployeeId, deviceId);
        return run is null ? NoContent() : Ok(ToInventoryRun(run));
    }

    [Authorize(Roles = "Employee,Admin"), HttpGet("inventory/runs/{runId}/pending")]
    public async Task<ActionResult<IEnumerable<InventoryItemDto>>> PendingInventory(string runId, [FromQuery] string deviceId, [FromQuery] int take = 3) =>
        Ok((await inventoryService.PendingItemsAsync(runId, EmployeeId, deviceId, take)).Select(x =>
            new InventoryItemDto(x.Id, x.RunId, x.Path, x.SizeBytes, x.ModifiedUnixSeconds, x.Status, x.Error, x.DiscoveredAt, x.BackedUpAt)));

    [Authorize(Roles = "Employee,Admin"), HttpPost("inventory/items/{itemId}/result")]
    public async Task<IActionResult> InventoryItemResult(string itemId, [FromQuery] string deviceId, InventoryItemResultDto result) =>
        await inventoryService.RecordResultAsync(itemId, EmployeeId, deviceId, result.Succeeded, result.Error) ? NoContent() : NotFound();

    [Authorize(Roles = "Admin"), HttpGet("inventory/runs")]
    public async Task<ActionResult<IEnumerable<InventoryRunDto>>> InventoryRuns([FromQuery] int take = 50) =>
        Ok((await inventoryService.ListRunsAsync(take)).Select(ToInventoryRun));

    [Authorize(Roles = "Admin"), HttpPost("inventory/runs/{runId}/start-backup")]
    public async Task<IActionResult> StartInventoryBackup(string runId) =>
        await inventoryService.StartBackupAsync(runId) ? NoContent() : NotFound();

    [Authorize(Roles = "Admin"), HttpGet("inventory/runs/{runId}/progress")]
    public async Task<ActionResult<InventoryProgressDto>> InventoryProgress(string runId)
    {
        var value = await inventoryService.ProgressAsync(runId);
        return value is null ? NotFound() : Ok(new InventoryProgressDto(value.RunId, value.Status, value.Total, value.Pending, value.BackedUp, value.Failed, value.Excluded));
    }

    [Authorize(Roles = "Admin"), HttpGet("inventory/runs/{runId}/files")]
    public async Task<ActionResult<IEnumerable<InventoryItemDto>>> InventoryFiles(string runId, [FromQuery] string? search = null,
        [FromQuery] string? status = null, [FromQuery] int skip = 0, [FromQuery] int take = 200) =>
        Ok((await inventoryService.ListItemsAsync(runId, search, status, skip, take)).Select(x =>
            new InventoryItemDto(x.Id, x.RunId, x.Path, x.SizeBytes, x.ModifiedUnixSeconds, x.Status, x.Error, x.DiscoveredAt, x.BackedUpAt)));

    [Authorize(Roles = "Admin"), HttpGet("inventory/rules")]
    public async Task<ActionResult<IEnumerable<BackupPathRuleDto>>> InventoryRules([FromQuery] string deviceId) =>
        Ok((await inventoryService.ListRulesAsync(deviceId)).Select(ToRule));

    [Authorize(Roles = "Admin"), HttpPut("inventory/rules")]
    public async Task<ActionResult<BackupPathRuleDto>> SetInventoryRule(SetBackupPathRuleDto request)
    {
        try { return Ok(ToRule(await inventoryService.SetRuleAsync(request.DeviceId, request.Path, request.Action))); }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
    }

    private static InventoryRunDto ToInventoryRun(ScreenshotMonitor.Data.Entities.BackupInventoryRun value) =>
        new(value.Id, value.EmployeeId, value.Employee?.FullName ?? "", value.DeviceId, value.Status, value.StartedAt, value.InventoryCompletedAt, value.BackupCompletedAt);
    private static BackupPathRuleDto ToRule(ScreenshotMonitor.Data.Entities.BackupPathRule value) =>
        new(value.Id, value.DeviceId, value.Path, value.Action, value.CreatedAt);
}
