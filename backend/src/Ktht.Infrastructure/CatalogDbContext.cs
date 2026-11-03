using Ktht.Domain;
using Microsoft.EntityFrameworkCore;
namespace Ktht.Infrastructure;
public sealed class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var category = modelBuilder.Entity<Category>();
        category.Property(c => c.Name).HasMaxLength(200).IsRequired();
        category.Property(c => c.Slug).HasMaxLength(100).IsRequired();
        category.HasIndex(c => c.Slug).IsUnique();
        var product = modelBuilder.Entity<Product>();
        product.Property(p => p.Name).HasMaxLength(200).IsRequired();
        product.Property(p => p.Sku).HasMaxLength(64).IsRequired();
        product.Property(p => p.Price).HasPrecision(18, 2);
        product.Property(p => p.Slug).HasMaxLength(200).IsRequired();
        product.Property(p => p.Description).HasMaxLength(4000).IsRequired();
        product.Property(p => p.ImageUrl).HasMaxLength(1000);
        product.HasIndex(p => p.Sku).IsUnique();
        product.HasIndex(p => p.Slug).IsUnique();
        product.HasOne(p => p.Category).WithMany().HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);
        product.ToTable(t => t.HasCheckConstraint("CK_Products_Price", "[Price] >= 0"));
        var variant = modelBuilder.Entity<ProductVariant>();
        variant.Property(v => v.Sku).HasMaxLength(64).IsRequired();
        variant.Property(v => v.Name).HasMaxLength(200).IsRequired();
        variant.Property(v => v.Price).HasPrecision(18, 2);
        variant.Property(v => v.ImageUrl).HasMaxLength(1000);
        variant.HasIndex(v => v.Sku).IsUnique();
        variant.HasOne(v => v.Product).WithMany(p => p.Variants).HasForeignKey(v => v.ProductId).OnDelete(DeleteBehavior.Restrict);
        variant.ToTable(t => t.HasCheckConstraint("CK_ProductVariants_Price", "[Price] >= 0"));
    }
}
