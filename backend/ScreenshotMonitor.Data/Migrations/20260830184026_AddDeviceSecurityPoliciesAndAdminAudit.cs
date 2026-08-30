using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceSecurityPoliciesAndAdminAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdminAuditLogs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    AdminId = table.Column<string>(type: "text", nullable: false),
                    Action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TargetType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TargetId = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BeforeJson = table.Column<string>(type: "text", nullable: false),
                    AfterJson = table.Column<string>(type: "text", nullable: false),
                    PreviousHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    EntryHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminAuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DeviceSecurityPolicies",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    DeviceId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MonitoringEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ScreenshotsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ActiveAppTrackingEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    IdleTrackingEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    BackupEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UsbAuditEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    NetworkAuditEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    FileChangeAuditEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AttendanceRemindersEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    RestoreEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedByAdminId = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeviceSecurityPolicies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeviceSecurityPolicies_Devices_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "Devices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditLogs_OccurredAt",
                table: "AdminAuditLogs",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceSecurityPolicies_DeviceId",
                table: "DeviceSecurityPolicies",
                column: "DeviceId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminAuditLogs");

            migrationBuilder.DropTable(
                name: "DeviceSecurityPolicies");
        }
    }
}
