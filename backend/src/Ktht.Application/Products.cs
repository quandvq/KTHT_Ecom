namespace Ktht.Application;

public sealed record CategoryItem(int Id, string Name, string Slug);
public sealed record BrandItem(int Id, string Name, string Slug);
public sealed record ProductItem(
    int Id,
    string Name,
    string Slug,
    string Sku,
    decimal Price,
    string? ImageUrl,
    CategoryItem Category,
    bool IsFeatured,
    BrandItem? Brand = null,
    string? PackageSize = null,
    string? SaleUnit = null,
    string Currency = "VND"
);

public sealed record ProductPage(IReadOnlyList<ProductItem> Items, int Page, int PageSize, int TotalCount);
public sealed record VariantItem(int Id, string Sku, string Name, decimal Price, string? ImageUrl, bool IsActive);
public sealed record ProductDetail(
    int Id,
    string Name,
    string Slug,
    string Description,
    string? ImageUrl,
    CategoryItem Category,
    IReadOnlyList<VariantItem> Variants,
    BrandItem? Brand = null,
    string? PackageSize = null,
    string? SaleUnit = null,
    string Currency = "VND"
);

public sealed record CatalogQuery(
    string? Q = null,
    string? Category = null,
    string Sort = "featured",
    int Page = 1,
    int PageSize = 12,
    bool? Featured = null,
    decimal? MinPrice = null,
    decimal? MaxPrice = null,
    string? Brand = null
)
{
    public Dictionary<string, string[]> Validate()
    {
        var errors = new Dictionary<string, string[]>();
        if (Page < 1 || PageSize is < 1 or > 100 || ((long)Page - 1) * PageSize > int.MaxValue)
            errors["pagination"] = ["Trang phải lớn hơn 0; kích thước trang từ 1 đến 100; vị trí trang không vượt giới hạn."];
        if (Q?.Length > 200) errors["q"] = ["Tìm kiếm tối đa 200 ký tự."];
        if (Category?.Length > 100) errors["category"] = ["Danh mục tối đa 100 ký tự."];
        if (Brand?.Length > 100) errors["brand"] = ["Thương hiệu tối đa 100 ký tự."];
        if (Sort is not ("featured" or "name" or "price-asc" or "price-desc")) errors["sort"] = ["Thứ tự sắp xếp không hợp lệ."];
        if (MinPrice < 0 || MaxPrice < 0 || MinPrice > 9999999999999999.99m || MaxPrice > 9999999999999999.99m || MinPrice > MaxPrice)
            errors["price"] = ["Khoảng giá không hợp lệ."];
        return errors;
    }
}

public interface IProductReader
{
    Task<IReadOnlyList<CategoryItem>> GetCategoriesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<BrandItem>> GetBrandsAsync(CancellationToken cancellationToken);
    Task<ProductPage> GetPageAsync(CatalogQuery query, CancellationToken cancellationToken);
    Task<ProductDetail?> GetDetailAsync(string slug, CancellationToken cancellationToken);
}
