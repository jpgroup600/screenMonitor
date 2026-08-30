using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ScreenshotMonitor.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminAuditSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "Sequence",
                table: "AdminAuditLogs",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.Sql("""
                UPDATE "AdminAuditLogs" AS target
                SET "Sequence" = ranked.sequence
                FROM (
                    SELECT "Id", ROW_NUMBER() OVER (ORDER BY "OccurredAt", "Id") AS sequence
                    FROM "AdminAuditLogs"
                ) AS ranked
                WHERE target."Id" = ranked."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_AdminAuditLogs_Sequence",
                table: "AdminAuditLogs",
                column: "Sequence",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AdminAuditLogs_Sequence",
                table: "AdminAuditLogs");

            migrationBuilder.DropColumn(
                name: "Sequence",
                table: "AdminAuditLogs");
        }
    }
}
