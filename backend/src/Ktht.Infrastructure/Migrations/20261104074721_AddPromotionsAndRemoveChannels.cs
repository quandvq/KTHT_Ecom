using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ktht.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPromotionsAndRemoveChannels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChannelAllocations");

            migrationBuilder.DropTable(
                name: "SalesChannels");

            migrationBuilder.DropIndex(
                name: "IX_Orders_IdempotencyKey",
                table: "Orders");

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountAmount",
                table: "Orders",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "PromotionCode",
                table: "Orders",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PromotionId",
                table: "Orders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequestHash",
                table: "Orders",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SubtotalAmount",
                table: "Orders",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.Sql("DELETE FROM [Orders] WHERE [OrderCode] LIKE 'EXT-%';");
            migrationBuilder.Sql("UPDATE [Orders] SET [SubtotalAmount] = [TotalAmount], [DiscountAmount] = 0 WHERE [SubtotalAmount] = 0;");
            migrationBuilder.Sql("UPDATE [InventoryBalances] SET [A] = 0;");

            migrationBuilder.CreateTable(
                name: "Promotions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    DiscountType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MinOrderAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MaxDiscount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    StartsAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndsAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UsageLimit = table.Column<int>(type: "int", nullable: true),
                    UsedCount = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Promotions", x => x.Id);
                    table.CheckConstraint("CK_Promotions_DiscountType", "[DiscountType] IN ('Percent', 'Fixed')");
                    table.CheckConstraint("CK_Promotions_MaxDiscount", "[MaxDiscount] IS NULL OR [MaxDiscount] > 0");
                    table.CheckConstraint("CK_Promotions_MinOrderAmount", "[MinOrderAmount] >= 0");
                    table.CheckConstraint("CK_Promotions_Usage", "[UsedCount] >= 0 AND ([UsageLimit] IS NULL OR [UsageLimit] >= 0 AND [UsedCount] <= [UsageLimit])");
                    table.CheckConstraint("CK_Promotions_Value", "[Value] > 0 AND ([DiscountType] <> 'Percent' OR [Value] <= 100)");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_IdempotencyKey",
                table: "Orders",
                column: "IdempotencyKey",
                unique: true,
                filter: "[IdempotencyKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PromotionId",
                table: "Orders",
                column: "PromotionId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_DiscountAmount",
                table: "Orders",
                sql: "[DiscountAmount] >= 0 AND [DiscountAmount] <= [SubtotalAmount]");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_SubtotalAmount",
                table: "Orders",
                sql: "[SubtotalAmount] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_TotalAmount",
                table: "Orders",
                sql: "[TotalAmount] = [SubtotalAmount] - [DiscountAmount]");

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_Code",
                table: "Promotions",
                column: "Code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_Promotions_PromotionId",
                table: "Orders",
                column: "PromotionId",
                principalTable: "Promotions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Orders_Promotions_PromotionId",
                table: "Orders");

            migrationBuilder.DropTable(
                name: "Promotions");

            migrationBuilder.DropIndex(
                name: "IX_Orders_IdempotencyKey",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_PromotionId",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_DiscountAmount",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_SubtotalAmount",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_TotalAmount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DiscountAmount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PromotionCode",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PromotionId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RequestHash",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "SubtotalAmount",
                table: "Orders");

            migrationBuilder.CreateTable(
                name: "SalesChannels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesChannels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChannelAllocations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChannelId = table.Column<int>(type: "int", nullable: false),
                    AllocatedQuota = table.Column<int>(type: "int", nullable: false),
                    Sku = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChannelAllocations_SalesChannels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "SalesChannels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_IdempotencyKey",
                table: "Orders",
                column: "IdempotencyKey");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelAllocations_ChannelId_Sku",
                table: "ChannelAllocations",
                columns: new[] { "ChannelId", "Sku" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SalesChannels_Code",
                table: "SalesChannels",
                column: "Code",
                unique: true);
        }
    }
}
