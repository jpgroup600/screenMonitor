using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScreenshotMonitor.Data.Dto.Backup;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Controllers;

[ApiController, Authorize(Roles = "Employee,Admin"), Route("api/backups")]
public class BackupsController(BackupService service) : ControllerBase
{
    private string EmployeeId => User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? throw new UnauthorizedAccessException();

    [HttpPost("upload"), RequestSizeLimit(1_200_000_000), RequestFormLimits(MultipartBodyLengthLimit = 1_200_000_000)]
    public async Task<ActionResult<BackupUploadResponseDto>> Upload(
        [FromForm] string deviceId, [FromForm] string originalPath, [FromForm] string contentHash,
        [FromForm] long plainSizeBytes, [FromForm] DateTime sourceModifiedAt, [FromForm] IFormFile encryptedFile,
        CancellationToken cancellationToken)
    {
        if (encryptedFile.Length == 0) return BadRequest(new { message = "Encrypted backup file is required." });
        try
        {
            await using var stream = encryptedFile.OpenReadStream();
            var (version, deduplicated) = await service.UploadAsync(EmployeeId, deviceId, originalPath, contentHash,
                plainSizeBytes, sourceModifiedAt, stream, encryptedFile.Length, cancellationToken);
            return Ok(new BackupUploadResponseDto(version.BackupFileId, version.Id, version.ObjectKey, deduplicated, version.UploadedAt));
        }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
    }
}
