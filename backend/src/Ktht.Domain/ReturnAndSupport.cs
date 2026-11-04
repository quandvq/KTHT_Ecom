namespace Ktht.Domain;

public class ReturnRequest
{
    public int Id { get; set; }
    public string ReturnCode { get; set; } = string.Empty;
    public int OrderId { get; set; }
    public Order? Order { get; set; }
    public int? CustomerId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "Requested"; // Requested, Approved, Received, QC_Completed, Rejected, Refunded
    public string? QCResult { get; set; } // Passed, Failed, Partial
    public decimal RefundAmount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ReturnItem> Items { get; set; } = new List<ReturnItem>();
}

public class ReturnItem
{
    public int Id { get; set; }
    public int ReturnRequestId { get; set; }
    public ReturnRequest? ReturnRequest { get; set; }
    public int OrderItemId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string QCStatus { get; set; } = "Pending"; // Pending, Passed, Failed
    public string? Note { get; set; }
}

public class SupportTicket
{
    public int Id { get; set; }
    public string TicketCode { get; set; } = string.Empty;
    public int? CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Category { get; set; } = "General"; // General, Order, Product, Shipping, Return
    public string Priority { get; set; } = "Medium"; // Low, Medium, High
    public string Status { get; set; } = "Open"; // Open, InProgress, Resolved, Closed
    public int? RelatedOrderId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TicketMessage> Messages { get; set; } = new List<TicketMessage>();
}

public class TicketMessage
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public SupportTicket? Ticket { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string SenderRole { get; set; } = "Customer"; // Customer, Staff
    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

