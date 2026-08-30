using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace ScreenshotMonitor.Data.Services;

public interface IBackupObjectStorage
{
    Task PutAsync(string objectKey, Stream encryptedContent, string contentType, CancellationToken cancellationToken = default);
    Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default);
    Task<Stream> OpenReadAsync(string objectKey, CancellationToken cancellationToken = default);
}
