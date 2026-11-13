using System.Data;
using Ktht.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ktht.Infrastructure;

public static class CatalogDemoSeed
{
    public static async Task RunAsync(CatalogDbContext db)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        // Catalog products are imported separately so seed reruns never recreate products
        // that operators intentionally removed (for example records without images).

        // 1. Seed users.
        var demoUsers = new (string Email, string Name, string Role, string Phone)[]
        {
            ("admin@ktht.local", "Quản trị viên Hệ thống", "Admin", "0901234567"),
            ("sales@ktht.local", "Nhân viên Bán hàng", "Sales", "0902345678"),
            ("warehouse@ktht.local", "Thủ kho Trung tâm", "Warehouse", "0903456789"),
            ("support@ktht.local", "Chăm sóc Khách hàng", "CustomerSupport", "0904567890"),
            ("customer@ktht.local", "Nguyễn Văn Khách", "Customer", "0905678901")
        };

        foreach (var (email, name, role, phone) in demoUsers)
        {
            if (!await db.Users.AnyAsync(u => u.Email == email))
            {
                var (hash, salt) = PasswordSecurity.HashPassword("Ktht@2026");
                var user = new User
                {
                    Email = email,
                    FullName = name,
                    Role = role,
                    PhoneNumber = phone,
                    PasswordHash = hash,
                    PasswordSalt = salt,
                    IsActive = true
                };
                db.Users.Add(user);
                await db.SaveChangesAsync();

                if (role == "Customer")
                {
                    db.CustomerAddresses.Add(new CustomerAddress
                    {
                        UserId = user.Id,
                        RecipientName = name,
                        PhoneNumber = phone,
                        StreetAddress = "59C Nguyễn Đình Chiểu",
                        Ward = "Phường Võ Thị Sáu",
                        District = "Quận 3",
                        City = "TP. Hồ Chí Minh",
                        IsDefault = true
                    });
                }
            }
        }
        await db.SaveChangesAsync();

        // 2. Seed exactly 50 deterministic promotions without overwriting existing usage.
        var demoPromotions = new List<Promotion>();
        demoPromotions.AddRange(Enumerable.Range(1, 20).Select(i => new Promotion
        {
            Code = $"SALE10-{i:00}", Description = "Giảm 10% tối đa 50.000đ", DiscountType = "Percent",
            Value = 10m, MinOrderAmount = 100000m, MaxDiscount = 50000m, UsageLimit = 100, IsActive = true
        }));
        demoPromotions.AddRange(Enumerable.Range(1, 15).Select(i => new Promotion
        {
            Code = $"GIAM20K-{i:00}", Description = "Giảm 20.000đ cho đơn từ 150.000đ", DiscountType = "Fixed",
            Value = 20000m, MinOrderAmount = 150000m, UsageLimit = 100, IsActive = true
        }));
        demoPromotions.AddRange(Enumerable.Range(1, 10).Select(i => new Promotion
        {
            Code = $"GIAM50K-{i:00}", Description = "Giảm 50.000đ cho đơn từ 500.000đ", DiscountType = "Fixed",
            Value = 50000m, MinOrderAmount = 500000m, UsageLimit = 100, IsActive = true
        }));
        demoPromotions.AddRange(Enumerable.Range(1, 5).Select(i => new Promotion
        {
            Code = $"VIP15-{i:00}", Description = "Giảm 15% tối đa 100.000đ", DiscountType = "Percent",
            Value = 15m, MinOrderAmount = 300000m, MaxDiscount = 100000m, UsageLimit = 50, IsActive = true
        }));
        var existingPromotionCodes = await db.Promotions.Select(p => p.Code).ToHashSetAsync();
        db.Promotions.AddRange(demoPromotions.Where(p => !existingPromotionCodes.Contains(p.Code)));
        await db.SaveChangesAsync();

        // 3. Seed InventoryBalances for all active variants
        var activeVariants = await db.ProductVariants.Where(v => v.IsActive).ToListAsync();
        var existingSkus = await db.InventoryBalances.Select(b => b.Sku).ToHashSetAsync();
        foreach (var v in activeVariants)
        {
            if (!existingSkus.Contains(v.Sku))
            {
                db.InventoryBalances.Add(new InventoryBalance
                {
                    Sku = v.Sku,
                    WarehouseCode = "WH-CENTRAL",
                    P = 100, // 100 physical on hand
                    Q = 0,   // 0 quarantined
                    B = 10,  // 10 safety stock
                    R = 0,   // 0 reserved
                    A = 0    // 0 channel quota (U = 100 - 0 - 10 - 0 - 0 = 90 available)
                });
            }
        }
        await db.SaveChangesAsync();

        // 4. Seed Demo Flash Sale if none exists
        if (!await db.FlashSales.AnyAsync())
        {
            var flashSaleVariants = await db.ProductVariants
                .Include(v => v.Product)
                .Where(v => v.IsActive && v.Product.IsPublished && !string.IsNullOrEmpty(v.Product.ImageUrl) && v.Price > 10000m)
                .OrderBy(v => v.Id)
                .Take(6)
                .ToListAsync();

            if (flashSaleVariants.Count > 0)
            {
                var flashSale = new FlashSale
                {
                    Name = "Flash Sale Giờ Vàng Dược Phẩm",
                    Description = "Săn deal giảm giá sốc đến 40% cho các sản phẩm chăm sóc sức khỏe chính hãng tại V-Pharma",
                    StartTime = DateTime.UtcNow.AddMinutes(-30),
                    EndTime = DateTime.UtcNow.AddHours(24),
                    IsActive = true
                };
                db.FlashSales.Add(flashSale);
                await db.SaveChangesAsync();

                foreach (var v in flashSaleVariants)
                {
                    var discountRate = 0.25m; // 25% off
                    var fsPrice = Math.Round(v.Price * (1m - discountRate) / 1000m, 0) * 1000m;
                    if (fsPrice >= v.Price) fsPrice = v.Price - 1000m;
                    if (fsPrice <= 0) fsPrice = Math.Max(1000m, v.Price - 1000m);

                    db.FlashSaleItems.Add(new FlashSaleItem
                    {
                        FlashSaleId = flashSale.Id,
                        ProductId = v.ProductId,
                        VariantId = v.Id,
                        Sku = v.Sku,
                        OriginalPrice = v.Price,
                        FlashSalePrice = fsPrice,
                        QuantityLimit = 50,
                        SoldCount = 14
                    });
                }
                await db.SaveChangesAsync();
            }
        }

        await transaction.CommitAsync();
    }
}
