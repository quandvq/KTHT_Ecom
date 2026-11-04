using System.Data;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Ktht.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ktht.Infrastructure;

public sealed record ImportResult(
    int TotalProcessed,
    int ProductsInserted,
    int ProductsUpdated,
    int ProductsSkipped,
    int CategoriesCreated,
    int CategoriesReused,
    int BrandsCreated,
    int BrandsReused,
    IReadOnlyList<string> Warnings
);

public static class PharmacityProductImporter
{
    public static async Task<ImportResult> ImportAsync(CatalogDbContext db, string csvFilePath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(csvFilePath))
            throw new FileNotFoundException($"Không tìm thấy file CSV tại: {csvFilePath}");

        var lines = await File.ReadAllLinesAsync(csvFilePath, Encoding.UTF8, cancellationToken);
        if (lines.Length <= 1)
            throw new InvalidOperationException("File CSV không có dữ liệu (chỉ có tiêu đề hoặc rỗng).");

        // Parse header to find column indexes
        var header = ParseCsvLine(lines[0]);
        var nameIdx = Array.IndexOf(header, "name");
        var categoryIdx = Array.IndexOf(header, "category");
        var brandIdx = Array.IndexOf(header, "brand");
        var packageSizeIdx = Array.IndexOf(header, "package_size");
        var saleUnitIdx = Array.IndexOf(header, "sale_unit");
        var priceVndIdx = Array.IndexOf(header, "price_vnd");
        var currencyIdx = Array.IndexOf(header, "currency");
        var descriptionIdx = Array.IndexOf(header, "description");
        var imageUrlIdx = Array.IndexOf(header, "image_url");

        if (nameIdx == -1 || categoryIdx == -1 || priceVndIdx == -1 || descriptionIdx == -1)
            throw new InvalidOperationException("File CSV thiếu các cột bắt buộc (name, category, price_vnd, description).");

        var warnings = new List<string>();
        int productsInserted = 0;
        int productsUpdated = 0;
        int productsSkipped = 0;
        int categoriesCreated = 0;
        int categoriesReused = 0;
        int brandsCreated = 0;
        int brandsReused = 0;

        // Transaction to ensure atomicity
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        // Load existing categories & brands into cache to avoid duplicate queries & creations
        var categoryCache = await db.Categories.ToDictionaryAsync(c => c.Name.ToLowerInvariant(), cancellationToken);
        var brandCache = await db.Brands.ToDictionaryAsync(b => b.Name.ToLowerInvariant(), cancellationToken);

        // Track used product slugs and SKUs in DB
        var existingSlugs = new HashSet<string>(await db.Products.Select(p => p.Slug).ToListAsync(cancellationToken));
        var existingSkus = new HashSet<string>(await db.Products.Select(p => p.Sku).ToListAsync(cancellationToken));
        var existingVariantSkus = new HashSet<string>(await db.ProductVariants.Select(v => v.Sku).ToListAsync(cancellationToken));

        int rowIndex = 0;
        for (int i = 1; i < lines.Length; i++)
        {
            var line = lines[i];
            if (string.IsNullOrWhiteSpace(line)) continue;

            rowIndex++;
            var fields = ParseCsvLine(line);

            // 1. name
            var rawName = GetField(fields, nameIdx);
            var name = NormalizeWhitespace(rawName);
            if (string.IsNullOrEmpty(name))
            {
                warnings.Add($"Dòng {i + 1}: Bỏ qua do thiếu tên sản phẩm.");
                productsSkipped++;
                continue;
            }

            // 2. category
            var rawCategory = GetField(fields, categoryIdx);
            var categoryName = NormalizeWhitespace(rawCategory);
            if (string.IsNullOrEmpty(categoryName))
            {
                warnings.Add($"Dòng {i + 1} ({name}): Bỏ qua do thiếu tên danh mục.");
                productsSkipped++;
                continue;
            }

            // 3. brand (allow NULL)
            var rawBrand = brandIdx >= 0 ? GetField(fields, brandIdx) : null;
            var brandName = NormalizeNullable(rawBrand);

            // 4. package_size (allow NULL)
            var rawPkg = packageSizeIdx >= 0 ? GetField(fields, packageSizeIdx) : null;
            var packageSize = NormalizeNullable(rawPkg);

            // 5. sale_unit (allow NULL)
            var rawUnit = saleUnitIdx >= 0 ? GetField(fields, saleUnitIdx) : null;
            var saleUnit = NormalizeNullable(rawUnit);

            // 6. price_vnd (DECIMAL, > 0)
            var rawPrice = GetField(fields, priceVndIdx);
            if (!decimal.TryParse(rawPrice, NumberStyles.Number, CultureInfo.InvariantCulture, out var priceVnd) || priceVnd <= 0)
            {
                warnings.Add($"Dòng {i + 1} ({name}): Bỏ qua do giá bán không hợp lệ ({rawPrice}).");
                productsSkipped++;
                continue;
            }

            // 7. currency (default "VND")
            var rawCurrency = currencyIdx >= 0 ? GetField(fields, currencyIdx) : "VND";
            var currency = string.IsNullOrWhiteSpace(rawCurrency) ? "VND" : rawCurrency.Trim().ToUpperInvariant();

            // 8. description (Unicode)
            var rawDesc = GetField(fields, descriptionIdx);
            var description = NormalizeWhitespace(rawDesc);
            if (string.IsNullOrEmpty(description))
            {
                description = $"Mô tả sản phẩm {name}.";
            }
            if (description.Length > 4000)
            {
                description = description[..4000];
            }

            // 9. image_url (allow NULL)
            var rawImageUrl = imageUrlIdx >= 0 ? GetField(fields, imageUrlIdx) : null;
            var imageUrl = NormalizeNullable(rawImageUrl);

            // Category resolution: reuse if exists, create if not
            var catKey = categoryName.ToLowerInvariant();
            if (!categoryCache.TryGetValue(catKey, out var category))
            {
                var catSlug = Slugify(categoryName);
                if (await db.Categories.AnyAsync(c => c.Slug == catSlug, cancellationToken))
                    catSlug = $"{catSlug}-{categoryCache.Count + 1}";

                category = new Category
                {
                    Name = categoryName,
                    Slug = catSlug
                };
                db.Categories.Add(category);
                await db.SaveChangesAsync(cancellationToken);
                categoryCache[catKey] = category;
                categoriesCreated++;
            }
            else
            {
                categoriesReused++;
            }

            // Brand resolution: reuse if exists, create if not, allow NULL
            Brand? brand = null;
            if (!string.IsNullOrEmpty(brandName))
            {
                var brandKey = brandName.ToLowerInvariant();
                if (!brandCache.TryGetValue(brandKey, out brand))
                {
                    var brandSlug = Slugify(brandName);
                    if (await db.Brands.AnyAsync(b => b.Slug == brandSlug, cancellationToken))
                        brandSlug = $"{brandSlug}-{brandCache.Count + 1}";

                    brand = new Brand
                    {
                        Name = brandName,
                        Slug = brandSlug
                    };
                    db.Brands.Add(brand);
                    await db.SaveChangesAsync(cancellationToken);
                    brandCache[brandKey] = brand;
                    brandsCreated++;
                }
                else
                {
                    brandsReused++;
                }
            }

            // Check for duplicate product in database
            // Rules: Compare normalized Name + CategoryId + BrandId
            var existingProduct = await db.Products
                .Include(p => p.Variants)
                .FirstOrDefaultAsync(p => p.Name == name && p.CategoryId == category.Id && p.BrandId == (brand != null ? brand.Id : (int?)null), cancellationToken);

            if (existingProduct != null)
            {
                // Verify if it is the same package_size and sale_unit
                bool samePackage = string.Equals(existingProduct.PackageSize, packageSize, StringComparison.OrdinalIgnoreCase);
                bool sameUnit = string.Equals(existingProduct.SaleUnit, saleUnit, StringComparison.OrdinalIgnoreCase);

                if (samePackage && sameUnit)
                {
                    // Exactly the same product: update price, description & image_url, do not duplicate
                    bool changed = false;
                    if (existingProduct.Price != priceVnd)
                    {
                        existingProduct.Price = priceVnd;
                        changed = true;
                    }
                    if (existingProduct.Description != description)
                    {
                        existingProduct.Description = description;
                        changed = true;
                    }
                    if (existingProduct.ImageUrl != imageUrl)
                    {
                        existingProduct.ImageUrl = imageUrl;
                        changed = true;
                    }

                    // Also sync variant price & image_url
                    var defaultVariant = existingProduct.Variants.FirstOrDefault();
                    if (defaultVariant != null)
                    {
                        if (defaultVariant.Price != priceVnd)
                        {
                            defaultVariant.Price = priceVnd;
                            changed = true;
                        }
                        if (defaultVariant.ImageUrl != imageUrl)
                        {
                            defaultVariant.ImageUrl = imageUrl;
                            changed = true;
                        }
                    }

                    if (changed)
                    {
                        productsUpdated++;
                    }
                    else
                    {
                        productsSkipped++;
                    }
                    continue;
                }
                else
                {
                    warnings.Add($"Dòng {i + 1} ({name}): Đã tồn tại sản phẩm cùng tên nhưng khác quy cách ({packageSize} vs {existingProduct.PackageSize}). Đang tạo sản phẩm với quy cách mới.");
                }
            }

            // Generate deterministic, unique SKU (format: PMC-0001, PMC-0002, ...)
            var baseSku = $"PMC-{rowIndex:0000}";
            var sku = baseSku;
            int skuCounter = 1;
            while (existingSkus.Contains(sku) || existingVariantSkus.Contains(sku))
            {
                sku = $"{baseSku}-{skuCounter++}";
            }
            existingSkus.Add(sku);

            // Generate deterministic, unique slug
            var baseSlug = Slugify(name);
            var slug = baseSlug;
            int slugCounter = 1;
            while (existingSlugs.Contains(slug))
            {
                slug = $"{baseSlug}-{slugCounter++}";
            }
            existingSlugs.Add(slug);

            var variantSku = $"{sku}-01";
            existingVariantSkus.Add(variantSku);

            var product = new Product
            {
                Name = name,
                Sku = sku,
                Price = priceVnd,
                IsPublished = true,
                IsFeatured = false,
                CategoryId = category.Id,
                BrandId = brand?.Id,
                PackageSize = packageSize,
                SaleUnit = saleUnit,
                Currency = currency,
                Description = description,
                Slug = slug,
                ImageUrl = imageUrl,
                Variants =
                [
                    new ProductVariant
                    {
                        Sku = variantSku,
                        Name = packageSize ?? saleUnit ?? "Tiêu chuẩn",
                        Price = priceVnd,
                        ImageUrl = imageUrl,
                        IsActive = true
                    }
                ]
            };

            db.Products.Add(product);
            productsInserted++;
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new ImportResult(
            TotalProcessed: rowIndex,
            ProductsInserted: productsInserted,
            ProductsUpdated: productsUpdated,
            ProductsSkipped: productsSkipped,
            CategoriesCreated: categoriesCreated,
            CategoriesReused: categoriesReused,
            BrandsCreated: brandsCreated,
            BrandsReused: brandsReused,
            Warnings: warnings
        );
    }

    private static string GetField(string[] fields, int index)
    {
        return index >= 0 && index < fields.Length ? fields[index] : "";
    }

    private static string NormalizeWhitespace(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return "";
        return Regex.Replace(input.Trim(), @"\s+", " ");
    }

    private static string? NormalizeNullable(string? input)
    {
        var normalized = NormalizeWhitespace(input);
        return string.IsNullOrEmpty(normalized) ? null : normalized;
    }

    public static string Slugify(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "";
        string normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (char c in normalized)
        {
            var uc = CharUnicodeInfo.GetUnicodeCategory(c);
            if (uc != UnicodeCategory.NonSpacingMark)
            {
                if (c == 'đ' || c == 'Đ') sb.Append('d');
                else sb.Append(c);
            }
        }
        string clean = sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
        clean = Regex.Replace(clean, @"[^a-z0-9\s-]", "");
        clean = Regex.Replace(clean, @"\s+", "-").Trim('-');
        return clean.Length > 180 ? clean[..180].TrimEnd('-') : clean;
    }

    public static string[] ParseCsvLine(string line)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++; // skip escaped quote
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }
        fields.Add(current.ToString());
        return fields.ToArray();
    }
}

