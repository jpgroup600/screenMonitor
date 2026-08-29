using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionAppAttributes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EndTime",
                table: "SessionForegroundApps",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartTime",
                table: "SessionForegroundApps",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "SessionForegroundApps",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndTime",
                table: "SessionBackgroundApps",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "StartTime",
                table: "SessionBackgroundApps",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "SessionBackgroundApps",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "SessionForegroundApps");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "SessionForegroundApps");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "SessionForegroundApps");

            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "SessionBackgroundApps");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "SessionBackgroundApps");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "SessionBackgroundApps");
        }
    }
}
