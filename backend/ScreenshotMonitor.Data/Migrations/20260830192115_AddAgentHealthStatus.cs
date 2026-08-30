using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentHealthStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AgentMode",
                table: "Devices",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "UserSession");

            migrationBuilder.AddColumn<string>(
                name: "AgentVersion",
                table: "Devices",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "unknown");

            migrationBuilder.AddColumn<string>(
                name: "MonitoringState",
                table: "Devices",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Unknown");

            migrationBuilder.AddColumn<int>(
                name: "PendingQueueItems",
                table: "Devices",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AgentMode",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "AgentVersion",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "MonitoringState",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "PendingQueueItems",
                table: "Devices");
        }
    }
}
