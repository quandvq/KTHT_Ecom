namespace Ktht.Domain;

public sealed class FlashSale
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<FlashSaleItem> Items { get; set; } = new List<FlashSaleItem>();

    public bool IsCurrentlyActive(DateTime utcNow) =>
        IsActive && StartTime <= utcNow && utcNow <= EndTime;
}

public sealed class FlashSaleItem
{
    public int Id { get; set; }
    public int FlashSaleId { get; set; }
    public FlashSale? FlashSale { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public int VariantId { get; set; }
    public ProductVariant? Variant { get; set; }
    public string Sku { get; set; } = string.Empty;
    public decimal OriginalPrice { get; set; }
    public decimal FlashSalePrice { get; set; }
    public int QuantityLimit { get; set; }
    public int SoldCount { get; set; }

    public int RemainingQuota => Math.Max(0, QuantityLimit - SoldCount);
    public int DiscountPercentage => OriginalPrice > 0
        ? (int)Math.Round((OriginalPrice - FlashSalePrice) * 100m / OriginalPrice, MidpointRounding.AwayFromZero)
        : 0;
}

