namespace Ktht.Domain;
public sealed class Product
{
    public int Id { get; set; }
    public required string Name { get; set; }
    // Legacy values retained to preserve existing data; public reads use Variants.
    public required string Sku { get; set; }
    public decimal Price { get; set; }
    public bool IsPublished { get; set; }
    public string Slug { get; set; } = "";
    public string Description { get; set; } = "";
    public string? ImageUrl { get; set; }
    public bool IsFeatured { get; set; }
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public int? BrandId { get; set; }
    public Brand? Brand { get; set; }
    public string? PackageSize { get; set; }
    public string? SaleUnit { get; set; }
    public string Currency { get; set; } = "VND";
    public List<ProductVariant> Variants { get; set; } = [];
}
