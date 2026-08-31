using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ScreenshotMonitor.API.Controllers;

[ApiController]
[Route("api/desktop-updates")]
public sealed class DesktopUpdatesController(IConfiguration configuration) : ControllerBase
{
    private static readonly Regex SemVer = new(@"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$", RegexOptions.Compiled);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    [AllowAnonymous]
    [HttpGet("latest.json")]
    public async Task<IActionResult> Latest(CancellationToken cancellationToken)
    {
        var manifest = await ReadManifest(cancellationToken);
        if (manifest is null) return NoContent();

        var baseUrl = configuration["DesktopUpdates:PublicBaseUrl"]?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            var forwardedScheme = Request.Headers["X-Forwarded-Proto"].FirstOrDefault();
            baseUrl = $"{forwardedScheme ?? Request.Scheme}://{Request.Host}";
        }

        return Ok(new
        {
            manifest.Version,
            manifest.Notes,
            pub_date = manifest.PublishedAt,
            platforms = new Dictionary<string, object>
            {
                ["windows-x86_64"] = new
                {
                    signature = manifest.Signature,
                    url = $"{baseUrl}/api/desktop-updates/download/{Uri.EscapeDataString(manifest.ArtifactFileName)}"
                }
            }
        });
    }

    [AllowAnonymous]
    [HttpGet("download/{fileName}")]
    public IActionResult Download(string fileName)
    {
        var safeName = Path.GetFileName(fileName);
        if (!string.Equals(fileName, safeName, StringComparison.Ordinal)) return BadRequest();
        var path = Path.Combine(StoragePath, safeName);
        if (!System.IO.File.Exists(path)) return NotFound();
        return PhysicalFile(path, "application/vnd.microsoft.portable-executable", safeName, enableRangeProcessing: true);
    }

    [AllowAnonymous]
    [HttpPost("publish")]
    [RequestSizeLimit(300L * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 300L * 1024 * 1024)]
    public async Task<IActionResult> Publish(
        [FromForm] string version,
        [FromForm] string? notes,
        [FromForm] IFormFile artifact,
        [FromForm] IFormFile signatureFile,
        CancellationToken cancellationToken)
    {
        if (!HasValidPublishingKey()) return Unauthorized();
        if (!SemVer.IsMatch(version)) return BadRequest("version must be valid SemVer");
        if (!artifact.FileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) || artifact.Length == 0)
            return BadRequest("artifact must be a non-empty NSIS .exe");

        using var signatureReader = new StreamReader(signatureFile.OpenReadStream());
        var signature = (await signatureReader.ReadToEndAsync(cancellationToken)).Trim();
        if (string.IsNullOrWhiteSpace(signature)) return BadRequest("signature file is empty");

        Directory.CreateDirectory(StoragePath);
        var artifactFileName = $"screen-monitor-desktop_{version}_x64-setup.exe";
        var destination = Path.Combine(StoragePath, artifactFileName);
        var temporary = destination + ".uploading";
        await using (var output = System.IO.File.Create(temporary))
            await artifact.CopyToAsync(output, cancellationToken);
        System.IO.File.Move(temporary, destination, true);

        var manifest = new ReleaseManifest(version, notes ?? "", DateTimeOffset.UtcNow, signature, artifactFileName);
        var manifestPath = ManifestPath;
        var manifestTemporary = manifestPath + ".uploading";
        await System.IO.File.WriteAllTextAsync(manifestTemporary, JsonSerializer.Serialize(manifest, JsonOptions), cancellationToken);
        System.IO.File.Move(manifestTemporary, manifestPath, true);
        return Ok(new { manifest.Version, manifest.PublishedAt, manifest.ArtifactFileName });
    }

    private bool HasValidPublishingKey()
    {
        var expected = configuration["DesktopUpdates:PublishingKey"];
        var supplied = Request.Headers["X-Desktop-Release-Key"].FirstOrDefault();
        if (string.IsNullOrEmpty(expected) || string.IsNullOrEmpty(supplied)) return false;
        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        var suppliedBytes = Encoding.UTF8.GetBytes(supplied);
        return expectedBytes.Length == suppliedBytes.Length && CryptographicOperations.FixedTimeEquals(expectedBytes, suppliedBytes);
    }

    private string StoragePath => configuration["DesktopUpdates:StoragePath"] ?? "/app/Updates";
    private string ManifestPath => Path.Combine(StoragePath, "latest.json");

    private async Task<ReleaseManifest?> ReadManifest(CancellationToken cancellationToken)
    {
        if (!System.IO.File.Exists(ManifestPath)) return null;
        await using var stream = System.IO.File.OpenRead(ManifestPath);
        return await JsonSerializer.DeserializeAsync<ReleaseManifest>(stream, JsonOptions, cancellationToken);
    }

    private sealed record ReleaseManifest(string Version, string Notes, DateTimeOffset PublishedAt, string Signature, string ArtifactFileName);
}
