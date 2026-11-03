using System.Data;
using Ktht.Domain;
using Microsoft.EntityFrameworkCore;
namespace Ktht.Infrastructure;

public static class CatalogDemoSeed
{
    public static async Task RunAsync(CatalogDbContext db)
    {
        // Serialize reruns; unique natural keys remain the final safeguard.
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
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
        string[] names = ["Khăn bông mềm", "Bàn chải mềm", "Lược gỗ", "Túi đựng cá nhân", "Gương cầm tay", "Hộp đựng tiện dụng", "Khăn lau gia đình", "Bình nước", "Túi giữ nhiệt", "Hộp chia ngăn", "Thảm tập", "Dây tập co giãn", "Túi thể thao", "Gối kê cổ", "Băng đô thể thao"];
        for (var i = 0; i < names.Length; i++)
        {
            var slug = $"demo-san-pham-{i + 1:00}";
            var sku = $"KTHT-DEMO-{i + 1:00}";
            // Never overwrite a record claiming the same natural key.
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
        await transaction.CommitAsync();
    }
}
