using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ScreenshotMonitor.Data.Context;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations;

[DbContext(typeof(SmDbContext))]
[Migration("20260829103000_AddAttendanceTracking")]
public class AddAttendanceTracking : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "AttendanceRecords",
            columns: table => new
            {
                Id = table.Column<string>(type: "text", nullable: false),
                EmployeeId = table.Column<string>(type: "text", nullable: false),
                ClockInAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                ClockOutAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                TotalIdleDuration = table.Column<TimeSpan>(type: "interval", nullable: false),
                Status = table.Column<string>(type: "text", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AttendanceRecords", x => x.Id);
                table.ForeignKey(
                    name: "FK_AttendanceRecords_Users_EmployeeId",
                    column: x => x.EmployeeId,
                    principalTable: "Users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "AttendanceIdlePeriods",
            columns: table => new
            {
                Id = table.Column<string>(type: "text", nullable: false),
                AttendanceRecordId = table.Column<string>(type: "text", nullable: false),
                StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                Duration = table.Column<TimeSpan>(type: "interval", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AttendanceIdlePeriods", x => x.Id);
                table.ForeignKey(
                    name: "FK_AttendanceIdlePeriods_AttendanceRecords_AttendanceRecordId",
                    column: x => x.AttendanceRecordId,
                    principalTable: "AttendanceRecords",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_AttendanceIdlePeriods_AttendanceRecordId",
            table: "AttendanceIdlePeriods",
            column: "AttendanceRecordId");

        migrationBuilder.CreateIndex(
            name: "IX_AttendanceRecords_EmployeeId",
            table: "AttendanceRecords",
            column: "EmployeeId",
            unique: true,
            filter: "\"Status\" = 'Active'");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "AttendanceIdlePeriods");
        migrationBuilder.DropTable(name: "AttendanceRecords");
    }
}
