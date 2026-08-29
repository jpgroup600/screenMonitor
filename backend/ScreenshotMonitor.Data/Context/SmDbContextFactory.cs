using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Configuration.Json;
using ScreenshotMonitor.Data.Context;
using System;
using System.IO;
public class SmDbContextFactory : IDesignTimeDbContextFactory<SmDbContext>
{
    public SmDbContext CreateDbContext(string[] args)
    {
        // Define the appsettings.json path (ensure it's located in your main project directory)
        var basePath = Directory.GetCurrentDirectory();
        var configPath = Path.Combine(basePath, "..", "ScreenshotMonitor.API", "appsettings.json");

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath) // Ensures JSON config can be found
            .AddJsonFile(configPath, optional: false, reloadOnChange: true)
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<SmDbContext>();

        var connectionString = configuration.GetConnectionString("SmDb");

        optionsBuilder.UseNpgsql(connectionString); // Change to UseMySQL for MySQL

        return new SmDbContext(optionsBuilder.Options);
    }
}
