using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ScreenshotMonitor.Data.Context;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations;

[DbContext(typeof(SmDbContext))]
[Migration("20260830195015_AddBackupResourcePolicy")]
public partial class AddBackupResourcePolicy : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<long>(
            name: "DailyUploadLimitBytes", table: "DeviceSecurityPolicies", type: "bigint",
            nullable: false, defaultValue: 10L * 1024 * 1024 * 1024);
        migrationBuilder.AddColumn<bool>(
            name: "PauseBackupOnBattery", table: "DeviceSecurityPolicies", type: "boolean",
            nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<bool>(
            name: "ResourceThrottlingEnabled", table: "DeviceSecurityPolicies", type: "boolean",
            nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<int>(
            name: "ScanThrottleMilliseconds", table: "DeviceSecurityPolicies", type: "integer",
            nullable: false, defaultValue: 2);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "DailyUploadLimitBytes", table: "DeviceSecurityPolicies");
        migrationBuilder.DropColumn(name: "PauseBackupOnBattery", table: "DeviceSecurityPolicies");
        migrationBuilder.DropColumn(name: "ResourceThrottlingEnabled", table: "DeviceSecurityPolicies");
        migrationBuilder.DropColumn(name: "ScanThrottleMilliseconds", table: "DeviceSecurityPolicies");
    }
}
