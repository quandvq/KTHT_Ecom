using Ktht.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ktht.Infrastructure;

public sealed class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Brand> Brands => Set<Brand>();

    // Module 1: Auth & User
    public DbSet<User> Users => Set<User>();
    public DbSet<CustomerAddress> CustomerAddresses => Set<CustomerAddress>();

    // Module 5: Order & Checkout
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderStatusHistory> OrderStatusHistories => Set<OrderStatusHistory>();
    public DbSet<Promotion> Promotions => Set<Promotion>();

    // Module 6: Inventory
    public DbSet<InventoryBalance> InventoryBalances => Set<InventoryBalance>();
    public DbSet<InventoryReservation> InventoryReservations => Set<InventoryReservation>();
    public DbSet<InventoryLedger> InventoryLedgers => Set<InventoryLedger>();

    // Module 8: Returns & Refunds
    public DbSet<ReturnRequest> ReturnRequests => Set<ReturnRequest>();
    public DbSet<ReturnItem> ReturnItems => Set<ReturnItem>();

    // Module 9: Support & CSKH
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<TicketMessage> TicketMessages => Set<TicketMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Brands
        var brand = modelBuilder.Entity<Brand>();
        brand.Property(b => b.Name).HasMaxLength(200).IsRequired();
        brand.Property(b => b.Slug).HasMaxLength(100).IsRequired();
        brand.HasIndex(b => b.Slug).IsUnique();

        // Categories
        var category = modelBuilder.Entity<Category>();
        category.Property(c => c.Name).HasMaxLength(200).IsRequired();
        category.Property(c => c.Slug).HasMaxLength(100).IsRequired();
        category.HasIndex(c => c.Slug).IsUnique();

        // Products
        var product = modelBuilder.Entity<Product>();
        product.Property(p => p.Name).HasMaxLength(200).IsRequired();
        product.Property(p => p.Sku).HasMaxLength(64).IsRequired();
        product.Property(p => p.Price).HasPrecision(18, 2);
        product.Property(p => p.Slug).HasMaxLength(200).IsRequired();
        product.Property(p => p.Description).HasMaxLength(4000).IsRequired();
        product.Property(p => p.ImageUrl).HasMaxLength(1000);
        product.Property(p => p.PackageSize).HasMaxLength(200);
        product.Property(p => p.SaleUnit).HasMaxLength(50);
        product.Property(p => p.Currency).HasMaxLength(10).HasDefaultValue("VND").IsRequired();
        product.HasIndex(p => p.Sku).IsUnique();
        product.HasIndex(p => p.Slug).IsUnique();
        product.HasOne(p => p.Category).WithMany().HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);
        product.HasOne(p => p.Brand).WithMany().HasForeignKey(p => p.BrandId).OnDelete(DeleteBehavior.Restrict);
        product.ToTable(t => t.HasCheckConstraint("CK_Products_Price", "[Price] >= 0"));

        // Variants
        var variant = modelBuilder.Entity<ProductVariant>();
        variant.Property(v => v.Sku).HasMaxLength(64).IsRequired();
        variant.Property(v => v.Name).HasMaxLength(200).IsRequired();
        variant.Property(v => v.Price).HasPrecision(18, 2);
        variant.Property(v => v.ImageUrl).HasMaxLength(1000);
        variant.HasIndex(v => v.Sku).IsUnique();
        variant.HasOne(v => v.Product).WithMany(p => p.Variants).HasForeignKey(v => v.ProductId).OnDelete(DeleteBehavior.Restrict);
        variant.ToTable(t => t.HasCheckConstraint("CK_ProductVariants_Price", "[Price] >= 0"));

        // Users
        var user = modelBuilder.Entity<User>();
        user.Property(u => u.Email).HasMaxLength(256).IsRequired();
        user.Property(u => u.FullName).HasMaxLength(200).IsRequired();
        user.Property(u => u.Role).HasMaxLength(50).IsRequired();
        user.Property(u => u.PhoneNumber).HasMaxLength(20);
        user.HasIndex(u => u.Email).IsUnique();

        // CustomerAddresses
        var addr = modelBuilder.Entity<CustomerAddress>();
        addr.Property(a => a.RecipientName).HasMaxLength(200).IsRequired();
        addr.Property(a => a.PhoneNumber).HasMaxLength(20).IsRequired();
        addr.Property(a => a.StreetAddress).HasMaxLength(500).IsRequired();
        addr.Property(a => a.City).HasMaxLength(100).IsRequired();
        addr.HasOne(a => a.User).WithMany(u => u.Addresses).HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);

        // Orders
        var order = modelBuilder.Entity<Order>();
        order.Property(o => o.OrderCode).HasMaxLength(64).IsRequired();
        order.Property(o => o.CustomerName).HasMaxLength(200).IsRequired();
        order.Property(o => o.CustomerEmail).HasMaxLength(256).IsRequired();
        order.Property(o => o.CustomerPhone).HasMaxLength(20).IsRequired();
        order.Property(o => o.ShippingAddress).HasMaxLength(1000).IsRequired();
        order.Property(o => o.PaymentMethod).HasMaxLength(50).IsRequired();
        order.Property(o => o.PaymentStatus).HasMaxLength(50).IsRequired();
        order.Property(o => o.Status).HasMaxLength(50).IsRequired();
        order.Property(o => o.TotalAmount).HasPrecision(18, 2);
        order.Property(o => o.SubtotalAmount).HasPrecision(18, 2);
        order.Property(o => o.DiscountAmount).HasPrecision(18, 2);
        order.Property(o => o.PromotionCode).HasMaxLength(50);
        order.Property(o => o.IdempotencyKey).HasMaxLength(128);
        order.Property(o => o.RequestHash).HasMaxLength(64);
        order.HasIndex(o => o.OrderCode).IsUnique();
        order.HasIndex(o => o.IdempotencyKey).IsUnique().HasFilter("[IdempotencyKey] IS NOT NULL");
        order.HasOne(o => o.User).WithMany().HasForeignKey(o => o.UserId).OnDelete(DeleteBehavior.SetNull);
        order.HasOne(o => o.Promotion).WithMany().HasForeignKey(o => o.PromotionId).OnDelete(DeleteBehavior.Restrict);
        order.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Orders_SubtotalAmount", "[SubtotalAmount] >= 0");
            t.HasCheckConstraint("CK_Orders_DiscountAmount", "[DiscountAmount] >= 0 AND [DiscountAmount] <= [SubtotalAmount]");
            t.HasCheckConstraint("CK_Orders_TotalAmount", "[TotalAmount] = [SubtotalAmount] - [DiscountAmount]");
        });

        // Promotions: a single nullable FK on Order enforces at most one code per order.
        var promotion = modelBuilder.Entity<Promotion>();
        promotion.Property(p => p.Code).HasMaxLength(50).IsRequired();
        promotion.Property(p => p.Description).HasMaxLength(300).IsRequired();
        promotion.Property(p => p.DiscountType).HasMaxLength(20).IsRequired();
        promotion.Property(p => p.Value).HasPrecision(18, 2);
        promotion.Property(p => p.MinOrderAmount).HasPrecision(18, 2);
        promotion.Property(p => p.MaxDiscount).HasPrecision(18, 2);
        promotion.HasIndex(p => p.Code).IsUnique();
        promotion.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Promotions_DiscountType", "[DiscountType] IN ('Percent', 'Fixed')");
            t.HasCheckConstraint("CK_Promotions_Value", "[Value] > 0 AND ([DiscountType] <> 'Percent' OR [Value] <= 100)");
            t.HasCheckConstraint("CK_Promotions_MinOrderAmount", "[MinOrderAmount] >= 0");
            t.HasCheckConstraint("CK_Promotions_MaxDiscount", "[MaxDiscount] IS NULL OR [MaxDiscount] > 0");
            t.HasCheckConstraint("CK_Promotions_Usage", "[UsedCount] >= 0 AND ([UsageLimit] IS NULL OR [UsageLimit] >= 0 AND [UsedCount] <= [UsageLimit])");
        });

        // OrderItems
        var orderItem = modelBuilder.Entity<OrderItem>();
        orderItem.Property(oi => oi.Sku).HasMaxLength(64).IsRequired();
        orderItem.Property(oi => oi.ProductName).HasMaxLength(200).IsRequired();
        orderItem.Property(oi => oi.UnitPrice).HasPrecision(18, 2);
        orderItem.Property(oi => oi.LineTotal).HasPrecision(18, 2);
        orderItem.HasOne(oi => oi.Order).WithMany(o => o.Items).HasForeignKey(oi => oi.OrderId).OnDelete(DeleteBehavior.Cascade);
        orderItem.HasOne(oi => oi.Product).WithMany().HasForeignKey(oi => oi.ProductId).OnDelete(DeleteBehavior.Restrict);

        // OrderStatusHistory
        var orderHistory = modelBuilder.Entity<OrderStatusHistory>();
        orderHistory.Property(h => h.FromStatus).HasMaxLength(50).IsRequired();
        orderHistory.Property(h => h.ToStatus).HasMaxLength(50).IsRequired();
        orderHistory.Property(h => h.Actor).HasMaxLength(100).IsRequired();
        orderHistory.HasOne(h => h.Order).WithMany(o => o.StatusHistories).HasForeignKey(h => h.OrderId).OnDelete(DeleteBehavior.Cascade);

        // InventoryBalances
        var invBalance = modelBuilder.Entity<InventoryBalance>();
        invBalance.Property(ib => ib.Sku).HasMaxLength(64).IsRequired();
        invBalance.Property(ib => ib.WarehouseCode).HasMaxLength(50).IsRequired();
        invBalance.HasIndex(ib => ib.Sku).IsUnique();

        // InventoryReservations
        var invRes = modelBuilder.Entity<InventoryReservation>();
        invRes.Property(r => r.Sku).HasMaxLength(64).IsRequired();
        invRes.Property(r => r.Status).HasMaxLength(50).IsRequired();
        invRes.HasOne(r => r.Order).WithMany().HasForeignKey(r => r.OrderId).OnDelete(DeleteBehavior.Cascade);

        // InventoryLedger
        var invLedger = modelBuilder.Entity<InventoryLedger>();
        invLedger.Property(l => l.TransactionCode).HasMaxLength(64).IsRequired();
        invLedger.Property(l => l.Sku).HasMaxLength(64).IsRequired();
        invLedger.Property(l => l.MovementType).HasMaxLength(50).IsRequired();
        invLedger.Property(l => l.Actor).HasMaxLength(100).IsRequired();

        // ReturnRequests
        var retReq = modelBuilder.Entity<ReturnRequest>();
        retReq.Property(r => r.ReturnCode).HasMaxLength(64).IsRequired();
        retReq.Property(r => r.Status).HasMaxLength(50).IsRequired();
        retReq.Property(r => r.RefundAmount).HasPrecision(18, 2);
        retReq.HasIndex(r => r.ReturnCode).IsUnique();
        retReq.HasOne(r => r.Order).WithMany().HasForeignKey(r => r.OrderId).OnDelete(DeleteBehavior.Restrict);

        // ReturnItems
        var retItem = modelBuilder.Entity<ReturnItem>();
        retItem.Property(ri => ri.Sku).HasMaxLength(64).IsRequired();
        retItem.Property(ri => ri.UnitPrice).HasPrecision(18, 2);
        retItem.Property(ri => ri.QCStatus).HasMaxLength(50).IsRequired();
        retItem.HasOne(ri => ri.ReturnRequest).WithMany(r => r.Items).HasForeignKey(ri => ri.ReturnRequestId).OnDelete(DeleteBehavior.Cascade);

        // SupportTickets
        var ticket = modelBuilder.Entity<SupportTicket>();
        ticket.Property(t => t.TicketCode).HasMaxLength(64).IsRequired();
        ticket.Property(t => t.CustomerName).HasMaxLength(200).IsRequired();
        ticket.Property(t => t.CustomerEmail).HasMaxLength(256).IsRequired();
        ticket.Property(t => t.Subject).HasMaxLength(300).IsRequired();
        ticket.Property(t => t.Category).HasMaxLength(50).IsRequired();
        ticket.Property(t => t.Priority).HasMaxLength(50).IsRequired();
        ticket.Property(t => t.Status).HasMaxLength(50).IsRequired();
        ticket.HasIndex(t => t.TicketCode).IsUnique();

        // TicketMessages
        var msg = modelBuilder.Entity<TicketMessage>();
        msg.Property(m => m.SenderName).HasMaxLength(200).IsRequired();
        msg.Property(m => m.SenderRole).HasMaxLength(50).IsRequired();
        msg.Property(m => m.Message).HasMaxLength(4000).IsRequired();
        msg.HasOne(m => m.Ticket).WithMany(t => t.Messages).HasForeignKey(m => m.TicketId).OnDelete(DeleteBehavior.Cascade);

    }
}
