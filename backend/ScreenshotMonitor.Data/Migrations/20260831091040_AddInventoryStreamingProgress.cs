using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryStreamingProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BackupRequested",
                table: "BackupInventoryRuns",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CurrentPath",
                table: "BackupInventoryRuns",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DiscoveredBytes",
                table: "BackupInventoryRuns",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "DiscoveredFiles",
                table: "BackupInventoryRuns",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "InaccessibleEntries",
                table: "BackupInventoryRuns",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastProgressAt",
                table: "BackupInventoryRuns",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "SkippedEntries",
                table: "BackupInventoryRuns",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BackupRequested",
                table: "BackupInventoryRuns");

            migrationBuilder.DropColumn(
                name: "CurrentPath",
                table: "BackupInventoryRuns");

            migrationBuilder.DropColumn(
                name: "DiscoveredBytes",
                table: "BackupInventoryRuns");

            migrationBuilder.DropColumn(
                name: "DiscoveredFiles",
                table: "BackupInventoryRuns");

            migrationBuilder.DropColumn(
                name: "InaccessibleEntries",
                table: "BackupInventoryRuns");

            migrationBuilder.DropColumn(
                name: "LastProgressAt",
                table: "BackupInventoryRuns");

            migrationBuilder.DropColumn(
                name: "SkippedEntries",
                table: "BackupInventoryRuns");
        }
    }
}
