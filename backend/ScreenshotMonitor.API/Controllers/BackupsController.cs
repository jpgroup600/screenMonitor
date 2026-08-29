using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Controllers;

[ApiController, Authorize(Roles = "Employee,Admin"), Route("api/backups")]
public class BackupsController(BackupService service) : ControllerBase
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
}
