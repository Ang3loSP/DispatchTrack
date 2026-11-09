using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DispatchTrack.API.Migrations
{
    /// <inheritdoc />
    public partial class Phase1_TripSheet_Core : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DispatchPlan",
                table: "Jobs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "TripSheetId",
                table: "Jobs",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TripSheets",
                columns: table => new
                {
                    TripSheetId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TripNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DispatchDestinationCategory = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    DriverId = table.Column<int>(type: "integer", nullable: false),
                    DriverName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TripStartDateTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TripEndDateTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TripSheets", x => x.TripSheetId);
                    table.ForeignKey(
                        name: "FK_TripSheets_Drivers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "Drivers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TripSheetItems",
                columns: table => new
                {
                    TripSheetItemId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TripSheetId = table.Column<long>(type: "bigint", nullable: false),
                    JobId = table.Column<int>(type: "integer", nullable: false),
                    StopNumber = table.Column<int>(type: "integer", nullable: false),
                    NonCustomerDestinationId = table.Column<int>(type: "integer", nullable: true),
                    NonTicketCustomerId = table.Column<int>(type: "integer", nullable: true),
                    NonTicketDescription = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<byte[]>(type: "bytea", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TripSheetItems", x => x.TripSheetItemId);
                    table.ForeignKey(
                        name: "FK_TripSheetItems_Jobs_JobId",
                        column: x => x.JobId,
                        principalTable: "Jobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TripSheetItems_TripSheets_TripSheetId",
                        column: x => x.TripSheetId,
                        principalTable: "TripSheets",
                        principalColumn: "TripSheetId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Jobs_TripSheetId",
                table: "Jobs",
                column: "TripSheetId");

            migrationBuilder.CreateIndex(
                name: "IX_TripSheetItems_JobId",
                table: "TripSheetItems",
                column: "JobId");

            migrationBuilder.CreateIndex(
                name: "IX_TripSheetItems_TripSheetId",
                table: "TripSheetItems",
                column: "TripSheetId");

            migrationBuilder.CreateIndex(
                name: "IX_TripSheets_DriverId",
                table: "TripSheets",
                column: "DriverId");

            migrationBuilder.CreateIndex(
                name: "IX_TripSheets_TripNumber",
                table: "TripSheets",
                column: "TripNumber",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Jobs_TripSheets_TripSheetId",
                table: "Jobs",
                column: "TripSheetId",
                principalTable: "TripSheets",
                principalColumn: "TripSheetId",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Jobs_TripSheets_TripSheetId",
                table: "Jobs");

            migrationBuilder.DropTable(
                name: "TripSheetItems");

            migrationBuilder.DropTable(
                name: "TripSheets");

            migrationBuilder.DropIndex(
                name: "IX_Jobs_TripSheetId",
                table: "Jobs");

            migrationBuilder.DropColumn(
                name: "DispatchPlan",
                table: "Jobs");

            migrationBuilder.DropColumn(
                name: "TripSheetId",
                table: "Jobs");
        }
    }
}
