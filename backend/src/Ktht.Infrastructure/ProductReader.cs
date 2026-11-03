using Ktht.Application;
using Microsoft.EntityFrameworkCore;

namespace Ktht.Infrastructure;

public sealed class ProductReader(CatalogDbContext db) : IProductReader
{
    public async Task<IReadOnlyList<CategoryItem>> GetCategoriesAsync(CancellationToken cancellationToken) =>
        await db.Categories.AsNoTracking().OrderBy(c => c.Name).Select(c => new CategoryItem(c.Id, c.Name, c.Slug)).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<BrandItem>> GetBrandsAsync(CancellationToken cancellationToken) =>
        await db.Brands.AsNoTracking().OrderBy(b => b.Name).Select(b => new BrandItem(b.Id, b.Name, b.Slug)).ToListAsync(cancellationToken);

    public async Task<ProductPage> GetPageAsync(CatalogQuery options, CancellationToken cancellationToken)
    {
        var products = db.Products.AsNoTracking().Include(p => p.Brand).Include(p => p.Category).Where(p => p.IsPublished && p.Variants.Any(v => v.IsActive));
        if (!string.IsNullOrWhiteSpace(options.Q))
        {
            var term = options.Q.Trim();
            products = products.Where(p => p.Name.Contains(term) || p.Variants.Any(v => v.IsActive && v.Sku.Contains(term)));
        }
        if (!string.IsNullOrWhiteSpace(options.Category)) products = products.Where(p => p.Category.Slug == options.Category);
        if (!string.IsNullOrWhiteSpace(options.Brand)) products = products.Where(p => p.Brand != null && p.Brand.Slug == options.Brand);
        if (options.Featured.HasValue) products = products.Where(p => p.IsFeatured == options.Featured.Value);

        var query = products.Select(p => new
        {
            Product = p,
            Variant = p.Variants.Where(v => v.IsActive).OrderBy(v => v.Price).ThenBy(v => v.Id).First()
        });

        if (options.MinPrice.HasValue) query = query.Where(p => p.Variant.Price >= options.MinPrice.Value);
        if (options.MaxPrice.HasValue) query = query.Where(p => p.Variant.Price <= options.MaxPrice.Value);

        var count = await query.CountAsync(cancellationToken);
        var sorted = options.Sort switch
        {
            "name" => query.OrderBy(p => p.Product.Name).ThenBy(p => p.Product.Id),
            "price-asc" => query.OrderBy(p => p.Variant.Price).ThenBy(p => p.Product.Id),
            "price-desc" => query.OrderByDescending(p => p.Variant.Price).ThenBy(p => p.Product.Id),
            _ => query.OrderByDescending(p => p.Product.IsFeatured).ThenBy(p => p.Product.Id)
        };

        var items = await sorted.Skip((options.Page - 1) * options.PageSize).Take(options.PageSize)
            .Select(p => new ProductItem(
                p.Product.Id,
                p.Product.Name,
                p.Product.Slug,
                p.Variant.Sku,
                p.Variant.Price,
                p.Variant.ImageUrl ?? p.Product.ImageUrl,
                new CategoryItem(p.Product.Category.Id, p.Product.Category.Name, p.Product.Category.Slug),
                p.Product.IsFeatured,
                p.Product.Brand == null ? null : new BrandItem(p.Product.Brand.Id, p.Product.Brand.Name, p.Product.Brand.Slug),
                p.Product.PackageSize,
                p.Product.SaleUnit,
                p.Product.Currency))
            .ToListAsync(cancellationToken);

        return new(items, options.Page, options.PageSize, count);
    }

    public async Task<ProductDetail?> GetDetailAsync(string slug, CancellationToken cancellationToken) =>
        await db.Products.AsNoTracking().Include(p => p.Brand).Include(p => p.Category)
            .Where(p => p.Slug == slug && p.IsPublished && p.Variants.Any(v => v.IsActive))
            .Select(p => new ProductDetail(
                p.Id,
                p.Name,
                p.Slug,
                p.Description,
                p.ImageUrl,
                new CategoryItem(p.Category.Id, p.Category.Name, p.Category.Slug),
                p.Variants.Where(v => v.IsActive).OrderBy(v => v.Price).ThenBy(v => v.Id)
                    .Select(v => new VariantItem(v.Id, v.Sku, v.Name, v.Price, v.ImageUrl, v.IsActive)).ToList(),
                p.Brand == null ? null : new BrandItem(p.Brand.Id, p.Brand.Name, p.Brand.Slug),
                p.PackageSize,
                p.SaleUnit,
                p.Currency))
            .SingleOrDefaultAsync(cancellationToken);
}
