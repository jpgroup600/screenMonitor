using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ScreenshotMonitor.Data.Entities;

public class FileVersion
{
    [Key] public string Id { get; set; } = Guid.NewGuid().ToString();
    [Required] public string BackupFileId { get; set; } = string.Empty;
    [ForeignKey(nameof(BackupFileId))] public BackupFile BackupFile { get; set; } = null!;
    [Required, MaxLength(64)] public string ContentHash { get; set; } = string.Empty;
    [Required, MaxLength(1024)] public string ObjectKey { get; set; } = string.Empty;
    public long PlainSizeBytes { get; set; }
    public long EncryptedSizeBytes { get; set; }
    public DateTime SourceModifiedAt { get; set; }
    public DateTime UploadedAt { get; set; }
}
