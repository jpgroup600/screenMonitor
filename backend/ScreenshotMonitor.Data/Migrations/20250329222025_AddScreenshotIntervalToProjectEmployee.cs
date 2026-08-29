using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddScreenshotIntervalToProjectEmployee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeSpan>(
                name: "ScreenshotInterval",
                table: "ProjectEmployees",
                type: "interval",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ScreenshotInterval",
                table: "ProjectEmployees");
        }
    }
}
