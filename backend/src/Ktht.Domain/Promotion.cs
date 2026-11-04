namespace Ktht.Domain;

public sealed class Promotion
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string DiscountType { get; set; } = "Fixed";
    public decimal Value { get; set; }
    public decimal MinOrderAmount { get; set; }
    public decimal? MaxDiscount { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public int? UsageLimit { get; set; }
    public int UsedCount { get; set; }
    public bool IsActive { get; set; } = true;

    public decimal CalculateDiscount(decimal subtotal)
    {
        if (subtotal <= 0) return 0;
        var discount = DiscountType == "Percent" ? subtotal * Value / 100m : Value;
        if (MaxDiscount.HasValue) discount = Math.Min(discount, MaxDiscount.Value);
        return decimal.Round(Math.Min(discount, subtotal), 0, MidpointRounding.AwayFromZero);
    }
}
