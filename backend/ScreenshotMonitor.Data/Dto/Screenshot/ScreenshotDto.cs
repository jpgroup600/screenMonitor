using System;

namespace ScreenshotMonitor.Data.Dto.Screenshot;

public class ScreenshotDto
{
    public string FilePath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
