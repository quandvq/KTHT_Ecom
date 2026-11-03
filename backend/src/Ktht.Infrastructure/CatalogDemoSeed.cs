using System.Data;
using Ktht.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ktht.Infrastructure;

public static class CatalogDemoSeed
{
    public static async Task RunAsync(CatalogDbContext db)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        // 1. Categories
        var definitions = new[] { ("cham-soc-ca-nhan", "Chăm sóc cá nhân"), ("cham-soc-gia-dinh", "Chăm sóc gia đình"), ("phu-kien-suc-khoe", "Phụ kiện sức khỏe") };
        var categories = new List<Category>();
        foreach (var (slug, name) in definitions)
        {
            var category = await db.Categories.SingleOrDefaultAsync(c => c.Slug == slug);
            if (category is null)
            {
                category = new Category { Slug = slug, Name = name };
                db.Categories.Add(category);
                await db.SaveChangesAsync();
            }
            categories.Add(category);
        }

        // 2. Demo Products
        string[] names = ["Khăn bông mềm", "Bàn chải mềm", "Lược gỗ", "Túi đựng cá nhân", "Gương cầm tay", "Hộp đựng tiện dụng", "Khăn lau gia đình", "Bình nước", "Túi giữ nhiệt", "Hộp chia ngăn", "Thảm tập", "Dây tập co giãn", "Túi thể thao", "Gối kê cổ", "Băng đô thể thao"];
        for (var i = 0; i < names.Length; i++)
        {
            var slug = $"demo-san-pham-{i + 1:00}";
            var sku = $"KTHT-DEMO-{i + 1:00}";
            if (await db.Products.AnyAsync(p => p.Slug == slug || p.Sku == sku) ||
                await db.ProductVariants.AnyAsync(v => v.Sku == sku + "-S" || v.Sku == sku + "-L" || v.Sku == sku + "-INACTIVE")) continue;
            var price = 25000m + i * 15000m;
            db.Products.Add(new Product
            {
                Name = names[i], Slug = slug, Sku = sku, Price = price, CategoryId = categories[i / 5].Id,
                Description = $"{names[i]} — dữ liệu giả phục vụ demo KTHT. Thông tin và giá chỉ dùng để kiểm thử danh mục.",
                IsPublished = true, IsFeatured = i % 3 == 0,
                Variants =
                [
                    new ProductVariant { Sku = sku + "-S", Name = "Tiêu chuẩn", Price = price, IsActive = true },
                    new ProductVariant { Sku = sku + "-L", Name = "Cỡ lớn", Price = price + 20000m, IsActive = true },
                    new ProductVariant { Sku = sku + "-INACTIVE", Name = "Ngừng niêm yết (demo)", Price = 1m, IsActive = false }
                ]
            });
        }
        foreach (var slug in new[] { "demo-unpublished", "demo-no-active-sku" })
        {
            if (await db.Products.AnyAsync(p => p.Slug == slug || p.Sku == slug) || await db.ProductVariants.AnyAsync(v => v.Sku == slug)) continue;
            db.Products.Add(new Product
            {
                Name = "Dữ liệu kiểm thử ẩn", Slug = slug, Sku = slug, Price = 1m,
                CategoryId = categories[0].Id, IsPublished = slug != "demo-unpublished",
                Variants = [new ProductVariant { Sku = slug, Name = "Kiểm thử", Price = 1m, IsActive = slug == "demo-unpublished" }]
            });
        }
        await db.SaveChangesAsync();

        // 3. Seed Users
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

        // 4. Seed SalesChannels
        var channels = new (string Code, string Name)[]
        {
            ("WEBSITE", "Website Cửa hàng Trực tuyến"),
            ("SHOPEE", "Gian hàng Shopee Mall"),
            ("LAZADA", "Gian hàng Lazada LazMall"),
            ("TIKTOK", "Gian hàng TikTok Shop")
        };
        foreach (var (code, name) in channels)
        {
            if (!await db.SalesChannels.AnyAsync(sc => sc.Code == code))
            {
                db.SalesChannels.Add(new SalesChannel { Code = code, Name = name, IsActive = true });
            }
        }
        await db.SaveChangesAsync();

        // 5. Seed InventoryBalances for all active variants
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

        await transaction.CommitAsync();
    }
}
