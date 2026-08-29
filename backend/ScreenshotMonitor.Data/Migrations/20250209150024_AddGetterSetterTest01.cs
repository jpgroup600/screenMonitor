using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGetterSetterTest01 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeSpan>(
                name: "TotalUsageTime",
                table: "SessionForegroundApps",
                type: "interval",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0));

            migrationBuilder.AddColumn<TimeSpan>(
                name: "TotalUsageTime",
                table: "SessionBackgroundApps",
                type: "interval",
                nullable: false,
                defaultValue: new TimeSpan(0, 0, 0, 0, 0));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalUsageTime",
                table: "SessionForegroundApps");

            migrationBuilder.DropColumn(
                name: "TotalUsageTime",
                table: "SessionBackgroundApps");
        }
    }
}
