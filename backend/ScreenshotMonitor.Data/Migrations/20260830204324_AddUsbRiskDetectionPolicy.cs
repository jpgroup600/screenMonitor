using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUsbRiskDetectionPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "UsbRiskDetectionEnabled",
                table: "DeviceSecurityPolicies",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UsbRiskDetectionEnabled",
                table: "DeviceSecurityPolicies");
        }
    }
}
