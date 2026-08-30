using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBackupRetentionPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "MaxBackupBytes",
                table: "DeviceSecurityPolicies",
                type: "bigint",
                nullable: false,
                defaultValue: 53687091200L);

            migrationBuilder.AddColumn<int>(
                name: "MaxVersionsPerFile",
                table: "DeviceSecurityPolicies",
                type: "integer",
                nullable: false,
                defaultValue: 20);

            migrationBuilder.AddColumn<int>(
                name: "RetentionDays",
                table: "DeviceSecurityPolicies",
                type: "integer",
                nullable: false,
                defaultValue: 90);

            migrationBuilder.AddColumn<bool>(
                name: "RetentionEnabled",
                table: "DeviceSecurityPolicies",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "StorageDeletionJobs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    ObjectKey = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastError = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StorageDeletionJobs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StorageDeletionJobs_ObjectKey",
                table: "StorageDeletionJobs",
                column: "ObjectKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StorageDeletionJobs");

            migrationBuilder.DropColumn(
                name: "MaxBackupBytes",
                table: "DeviceSecurityPolicies");

            migrationBuilder.DropColumn(
                name: "MaxVersionsPerFile",
                table: "DeviceSecurityPolicies");

            migrationBuilder.DropColumn(
                name: "RetentionDays",
                table: "DeviceSecurityPolicies");

            migrationBuilder.DropColumn(
                name: "RetentionEnabled",
                table: "DeviceSecurityPolicies");
        }
    }
}
