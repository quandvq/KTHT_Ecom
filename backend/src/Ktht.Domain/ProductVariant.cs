namespace Ktht.Domain;
public sealed class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public required string Sku { get; set; }
    public required string Name { get; set; }
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    // Listing status only, not inventory availability.
    public bool IsActive { get; set; }
}
