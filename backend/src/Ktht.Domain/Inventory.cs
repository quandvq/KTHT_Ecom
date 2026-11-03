namespace Ktht.Domain;

public class InventoryBalance
{
    public int Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string WarehouseCode { get; set; } = "WH-CENTRAL";
    public int P { get; set; } // Physical on-hand
    public int Q { get; set; } // Quarantined
    public int B { get; set; } // Safety stock
    public int R { get; set; } // Reserved for accepted orders
    public int A { get; set; } // Channel quota committed

    // Available uncommitted stock: U = P - Q - B - R - A
    public int AvailableStock => Math.Max(0, P - Q - B - R - A);
}

public class InventoryReservation
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order? Order { get; set; }
    public string Sku { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string Status { get; set; } = "Active"; // Active, Fulfilled, Released
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class InventoryLedger
{
    public int Id { get; set; }
    public string TransactionCode { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string MovementType { get; set; } = string.Empty; // Reserve, Release, Issue, Receive, Quarantine, QC_Pass, QC_Fail, Allocation
    public int DeltaP { get; set; }
    public int DeltaQ { get; set; }
    public int DeltaB { get; set; }
    public int DeltaR { get; set; }
    public int DeltaA { get; set; }
    public string? Reason { get; set; }
    public string Actor { get; set; } = "System";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

