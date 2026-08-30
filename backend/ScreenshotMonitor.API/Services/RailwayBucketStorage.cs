using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using ScreenshotMonitor.Data.Services;

namespace ScreenshotMonitor.API.Services;

public class RailwayBucketStorage : IBackupObjectStorage, IDisposable
{
    private readonly IAmazonS3 client;
    private readonly string bucketName;

    public RailwayBucketStorage(IConfiguration configuration)
    {
        var endpoint = Required(configuration, "ENDPOINT", "AWS_ENDPOINT_URL");
        var accessKey = Required(configuration, "ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID");
        var secretKey = Required(configuration, "SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY");
        bucketName = Required(configuration, "BUCKET", "AWS_S3_BUCKET_NAME");
        var pathStyle = string.Equals(configuration["AWS_S3_URL_STYLE"], "path", StringComparison.OrdinalIgnoreCase);
        client = new AmazonS3Client(new BasicAWSCredentials(accessKey, secretKey), new AmazonS3Config {
            ServiceURL = endpoint, ForcePathStyle = pathStyle, AuthenticationRegion = configuration["REGION"] ?? configuration["AWS_DEFAULT_REGION"] ?? "auto"
        });
    }

    public async Task PutAsync(string objectKey, Stream encryptedContent, string contentType, CancellationToken cancellationToken = default)
    {
        await client.PutObjectAsync(new PutObjectRequest {
            BucketName = bucketName, Key = objectKey, InputStream = encryptedContent,
            ContentType = contentType, AutoCloseStream = false
        }, cancellationToken);
    }

    public Task DeleteAsync(string objectKey, CancellationToken cancellationToken = default) =>
        client.DeleteObjectAsync(bucketName, objectKey, cancellationToken);

    public async Task<Stream> OpenReadAsync(string objectKey, CancellationToken cancellationToken = default) =>
        (await client.GetObjectAsync(bucketName, objectKey, cancellationToken)).ResponseStream;

    public void Dispose() => client.Dispose();

    private static string Required(IConfiguration configuration, params string[] names) =>
        names.Select(name => configuration[name]).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))
        ?? throw new InvalidOperationException($"Missing Railway Bucket setting: {string.Join(" or ", names)}");
}
