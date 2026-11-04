using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Ktht.Application;
using Ktht.Domain;
using Ktht.Infrastructure;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=(localdb)\\mssqllocaldb;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True";

builder.Services.AddDbContext<CatalogDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddScoped<IProductReader, ProductReader>();
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173").AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler(exceptionApp => exceptionApp.Run(async context =>
{
    var feature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
    if (feature?.Error is BadHttpRequestException badHttp)
    {
        context.Response.StatusCode = badHttp.StatusCode;
        await Results.Problem(statusCode: badHttp.StatusCode, detail: badHttp.Message).ExecuteAsync(context);
        return;
    }
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await Results.Problem(statusCode: StatusCodes.Status500InternalServerError, detail: "Đã xảy ra lỗi hệ thống.").ExecuteAsync(context);
}));

app.UseCors();

// CLI Tools
if (args.Contains("--seed-demo"))
{
    if (!app.Environment.IsDevelopment())
        throw new InvalidOperationException("Demo seed requires ASPNETCORE_ENVIRONMENT=Development.");
    using var scope = app.Services.CreateScope();
    await CatalogDemoSeed.RunAsync(scope.ServiceProvider.GetRequiredService<CatalogDbContext>());
    return;
}
if (args.Contains("--import-pharmacity"))
{
    if (!app.Environment.IsDevelopment())
        throw new InvalidOperationException("Import requires ASPNETCORE_ENVIRONMENT=Development.");
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
    var csvPath = File.Exists("pharmacity_products_2026-11-03.csv")
        ? Path.GetFullPath("pharmacity_products_2026-11-03.csv")
        : (File.Exists("../../pharmacity_products_2026-11-03.csv")
            ? Path.GetFullPath("../../pharmacity_products_2026-11-03.csv")
            : "d:/KTHT/KTHT_Ecom/pharmacity_products_2026-11-03.csv");
    var result = await PharmacityProductImporter.ImportAsync(db, csvPath);
    Console.WriteLine($"[IMPORT PHARMACITY SUCCESS]");
    Console.WriteLine($"Products Read: {result.TotalProcessed}");
    Console.WriteLine($"Products Inserted: {result.ProductsInserted}");
    Console.WriteLine($"Products Updated: {result.ProductsUpdated}");
    Console.WriteLine($"Products Skipped: {result.ProductsSkipped}");
    Console.WriteLine($"Categories Created: {result.CategoriesCreated}");
    Console.WriteLine($"Categories Reused: {result.CategoriesReused}");
    Console.WriteLine($"Brands Created: {result.BrandsCreated}");
    Console.WriteLine($"Brands Reused: {result.BrandsReused}");
    return;
}

// Auth Helper
static AuthUserClaims? GetCurrentUser(HttpContext context)
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    return JwtTokenService.ValidateToken(authHeader);
}

static IResult RequireAuth(HttpContext context, out AuthUserClaims user, string? requiredRole = null)
{
    var current = GetCurrentUser(context);
    if (current == null)
    {
        user = null!;
        return Results.StatusCode(StatusCodes.Status401Unauthorized);
    }
    if (requiredRole != null && !string.Equals(current.Role, requiredRole, StringComparison.OrdinalIgnoreCase) && !string.Equals(current.Role, "Admin", StringComparison.OrdinalIgnoreCase))
    {
        user = null!;
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }
    user = current;
    return null!;
}

static string? GetPromotionError(Promotion promotion, decimal subtotal, DateTime now)
{
    if (!promotion.IsActive) return "Mã khuyến mãi không hoạt động.";
    if (promotion.StartsAt.HasValue && promotion.StartsAt.Value > now) return "Mã khuyến mãi chưa đến thời gian sử dụng.";
    if (promotion.EndsAt.HasValue && promotion.EndsAt.Value < now) return "Mã khuyến mãi đã hết hạn.";
    if (promotion.UsageLimit.HasValue && promotion.UsedCount >= promotion.UsageLimit.Value) return "Mã khuyến mãi đã hết lượt sử dụng.";
    if (subtotal < promotion.MinOrderAmount) return $"Đơn hàng cần tối thiểu {promotion.MinOrderAmount:N0}đ để dùng mã này.";
    return null;
}

static string GetOrderRequestHash(CreateOrderRequest request)
{
    var lines = string.Join('|', request.Items.OrderBy(i => i.Sku, StringComparer.Ordinal)
        .ThenBy(i => i.Quantity).Select(i => $"{i.Sku.Trim()}:{i.Quantity}"));
    var canonical = string.Join('\n', request.CustomerName.Trim(), request.CustomerEmail?.Trim() ?? "",
        request.CustomerPhone.Trim(), request.ShippingAddress.Trim(), request.PaymentMethod?.Trim() ?? "COD",
        request.Note?.Trim() ?? "", request.PromotionCode?.Trim().ToUpperInvariant() ?? "", lines);
    return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
}

// ==========================================
// MODULE 1: AUTHENTICATION & USER PROFILE
// ==========================================
app.MapPost("/api/auth/register", async (RegisterRequest req, CatalogDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password) || string.IsNullOrWhiteSpace(req.FullName))
        return Results.BadRequest(new { message = "Vui lòng điền đầy đủ họ tên, email và mật khẩu." });

    if (req.Password.Length < 6)
        return Results.BadRequest(new { message = "Mật khẩu phải từ 6 ký tự trở lên." });

    var normalizedEmail = req.Email.Trim().ToLowerInvariant();
    if (await db.Users.AnyAsync(u => u.Email == normalizedEmail))
        return Results.Conflict(new { message = "Email này đã được sử dụng." });

    var (hash, salt) = PasswordSecurity.HashPassword(req.Password);
    var user = new User
    {
        Email = normalizedEmail,
        FullName = req.FullName.Trim(),
        PasswordHash = hash,
        PasswordSalt = salt,
        PhoneNumber = req.PhoneNumber?.Trim(),
        Role = "Customer",
        IsActive = true
    };
    db.Users.Add(user);
    await db.SaveChangesAsync();

    var token = JwtTokenService.GenerateToken(user);
    return Results.Ok(new
    {
        token,
        user = new { user.Id, user.Email, user.FullName, user.Role, user.PhoneNumber }
    });
});

app.MapPost("/api/auth/login", async (LoginRequest req, CatalogDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
        return Results.BadRequest(new { message = "Vui lòng nhập email và mật khẩu." });

    var normalizedEmail = req.Email.Trim().ToLowerInvariant();
    var user = await db.Users.Include(u => u.Addresses).SingleOrDefaultAsync(u => u.Email == normalizedEmail);

    if (user == null || !user.IsActive || !PasswordSecurity.VerifyPassword(req.Password, user.PasswordHash, user.PasswordSalt))
        return Results.BadRequest(new { message = "Email hoặc mật khẩu không chính xác." });

    var token = JwtTokenService.GenerateToken(user);
    return Results.Ok(new
    {
        token,
        user = new { user.Id, user.Email, user.FullName, user.Role, user.PhoneNumber }
    });
});

app.MapGet("/api/auth/me", async (HttpContext context, CatalogDbContext db) =>
{
    var current = GetCurrentUser(context);
    if (current == null) return Results.StatusCode(StatusCodes.Status401Unauthorized);

    var user = await db.Users.Include(u => u.Addresses).SingleOrDefaultAsync(u => u.Id == current.Id);
    if (user == null) return Results.NotFound();

    var defaultAddr = user.Addresses.FirstOrDefault(a => a.IsDefault) ?? user.Addresses.FirstOrDefault();
    return Results.Ok(new
    {
        user.Id,
        user.Email,
        user.FullName,
        user.Role,
        user.PhoneNumber,
        address = defaultAddr == null ? null : new
        {
            defaultAddr.RecipientName,
            defaultAddr.PhoneNumber,
            defaultAddr.StreetAddress,
            defaultAddr.Ward,
            defaultAddr.District,
            defaultAddr.City
        }
    });
});

app.MapPut("/api/auth/profile", async (UpdateProfileRequest req, HttpContext context, CatalogDbContext db) =>
{
    var current = GetCurrentUser(context);
    if (current == null) return Results.StatusCode(StatusCodes.Status401Unauthorized);

    var user = await db.Users.FindAsync(current.Id);
    if (user == null) return Results.NotFound();

    if (!string.IsNullOrWhiteSpace(req.FullName)) user.FullName = req.FullName.Trim();
    if (req.PhoneNumber != null) user.PhoneNumber = req.PhoneNumber.Trim();

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Cập nhật hồ sơ thành công.", user = new { user.Id, user.Email, user.FullName, user.PhoneNumber, user.Role } });
});

app.MapPut("/api/auth/address", async (SaveAddressRequest req, HttpContext context, CatalogDbContext db) =>
{
    var current = GetCurrentUser(context);
    if (current == null) return Results.StatusCode(StatusCodes.Status401Unauthorized);

    var address = await db.CustomerAddresses.FirstOrDefaultAsync(a => a.UserId == current.Id && a.IsDefault)
        ?? await db.CustomerAddresses.FirstOrDefaultAsync(a => a.UserId == current.Id);

    if (address == null)
    {
        address = new CustomerAddress { UserId = current.Id, IsDefault = true };
        db.CustomerAddresses.Add(address);
    }

    address.RecipientName = req.RecipientName.Trim();
    address.PhoneNumber = req.PhoneNumber.Trim();
    address.StreetAddress = req.StreetAddress.Trim();
    address.Ward = req.Ward?.Trim();
    address.District = req.District?.Trim();
    address.City = req.City.Trim();

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Lưu địa chỉ thành công.", address });
});

app.MapPost("/api/auth/change-password", async (ChangePasswordRequest req, HttpContext context, CatalogDbContext db) =>
{
    var current = GetCurrentUser(context);
    if (current == null) return Results.StatusCode(StatusCodes.Status401Unauthorized);

    var user = await db.Users.FindAsync(current.Id);
    if (user == null) return Results.NotFound();

    if (!PasswordSecurity.VerifyPassword(req.CurrentPassword, user.PasswordHash, user.PasswordSalt))
        return Results.BadRequest(new { message = "Mật khẩu hiện tại không chính xác." });

    if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
        return Results.BadRequest(new { message = "Mật khẩu mới phải từ 6 ký tự trở lên." });

    var (hash, salt) = PasswordSecurity.HashPassword(req.NewPassword);
    user.PasswordHash = hash;
    user.PasswordSalt = salt;
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Đổi mật khẩu thành công." });
});

// ==========================================
// MODULE 2: PRODUCT CATALOG (PUBLIC)
// ==========================================
app.MapGet("/api/categories", async (IProductReader reader, CancellationToken cancellationToken) =>
    Results.Ok(await reader.GetCategoriesAsync(cancellationToken)));

app.MapGet("/api/brands", async (IProductReader reader, CancellationToken cancellationToken) =>
    Results.Ok(await reader.GetBrandsAsync(cancellationToken)));

app.MapGet("/api/products", async (string? q, string? category, string? brand, string? sort, int? page, int? pageSize, bool? featured,
    decimal? minPrice, decimal? maxPrice, IProductReader reader, CancellationToken cancellationToken) =>
{
    var query = new CatalogQuery(q, category, sort ?? "featured", page ?? 1, pageSize ?? 12, featured, minPrice, maxPrice, brand);
    var errors = query.Validate();
    if (errors.Count > 0) return Results.ValidationProblem(errors);
    return Results.Ok(await reader.GetPageAsync(query, cancellationToken));
});

app.MapGet("/api/products/{slug}", async (string slug, IProductReader reader, CancellationToken cancellationToken) =>
{
    if (slug.Length > 200) return Results.NotFound();
    var product = await reader.GetDetailAsync(slug, cancellationToken);
    return product is null ? Results.NotFound() : Results.Ok(product);
});

// ==========================================
// MODULE 3: PRODUCT MANAGEMENT (ADMIN/SALES)
// ==========================================
app.MapPost("/api/admin/products", async (CreateProductRequest req, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Sales");
    if (authRes != null) return authRes;

    if (string.IsNullOrWhiteSpace(req.Name) || req.Price < 0)
        return Results.BadRequest(new { message = "Tên và giá sản phẩm không hợp lệ." });

    var slug = Regex.Replace(req.Name.ToLowerInvariant(), @"[^a-z0-9\s-]", "").Replace(" ", "-").Trim('-');
    if (string.IsNullOrWhiteSpace(slug)) slug = "sp-" + Guid.NewGuid().ToString("N")[..8];
    while (await db.Products.AnyAsync(p => p.Slug == slug))
        slug += "-" + Random.Shared.Next(10, 99);

    var sku = req.Sku?.Trim() ?? ("SKU-" + Guid.NewGuid().ToString("N")[..8].ToUpper());
    while (await db.Products.AnyAsync(p => p.Sku == sku))
        sku = "SKU-" + Guid.NewGuid().ToString("N")[..8].ToUpper();

    var product = new Product
    {
        Name = req.Name.Trim(),
        Slug = slug,
        Sku = sku,
        Price = req.Price,
        CategoryId = req.CategoryId,
        BrandId = req.BrandId,
        Description = req.Description?.Trim() ?? req.Name.Trim(),
        ImageUrl = req.ImageUrl,
        PackageSize = req.PackageSize,
        SaleUnit = req.SaleUnit ?? "Hộp",
        Currency = "VND",
        IsPublished = req.IsPublished,
        IsFeatured = req.IsFeatured,
        Variants = new List<ProductVariant>
        {
            new ProductVariant
            {
                Sku = sku + "-01",
                Name = req.PackageSize ?? req.SaleUnit ?? "Tiêu chuẩn",
                Price = req.Price,
                IsActive = true
            }
        }
    };
    db.Products.Add(product);
    await db.SaveChangesAsync();

    // Initialize Inventory Balance
    db.InventoryBalances.Add(new InventoryBalance
    {
        Sku = sku + "-01",
        WarehouseCode = "WH-CENTRAL",
        P = 100,
        B = 10,
        Q = 0,
        R = 0,
        A = 0
    });
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Tạo sản phẩm thành công.", product });
});

app.MapPut("/api/admin/products/{id:int}", async (int id, UpdateProductRequest req, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Sales");
    if (authRes != null) return authRes;

    var product = await db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == id);
    if (product == null) return Results.NotFound();

    if (!string.IsNullOrWhiteSpace(req.Name)) product.Name = req.Name.Trim();
    if (req.Price.HasValue && req.Price.Value >= 0)
    {
        product.Price = req.Price.Value;
        foreach (var v in product.Variants) v.Price = req.Price.Value;
    }
    if (req.CategoryId.HasValue) product.CategoryId = req.CategoryId.Value;
    if (req.BrandId.HasValue) product.BrandId = req.BrandId.Value;
    if (req.Description != null) product.Description = req.Description.Trim();
    if (req.ImageUrl != null) product.ImageUrl = req.ImageUrl;
    if (req.PackageSize != null) product.PackageSize = req.PackageSize;
    if (req.SaleUnit != null) product.SaleUnit = req.SaleUnit;
    if (req.IsPublished.HasValue) product.IsPublished = req.IsPublished.Value;
    if (req.IsFeatured.HasValue) product.IsFeatured = req.IsFeatured.Value;

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Cập nhật sản phẩm thành công.", product });
});

app.MapDelete("/api/admin/products/{id:int}", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Sales");
    if (authRes != null) return authRes;

    var product = await db.Products.FindAsync(id);
    if (product == null) return Results.NotFound();

    // Soft delete / unpublish to protect transaction history
    product.IsPublished = !product.IsPublished;
    await db.SaveChangesAsync();

    return Results.Ok(new { message = product.IsPublished ? "Đã công khai sản phẩm." : "Đã ẩn sản phẩm khỏi cửa hàng.", isPublished = product.IsPublished });
});

// ==========================================
// MODULE 4: SHOPPING CART VALIDATION
// ==========================================
app.MapPost("/api/cart/validate", async (CartValidateRequest req, CatalogDbContext db) =>
{
    var validatedItems = new List<object>();
    decimal totalAmount = 0;

    foreach (var line in req.Items)
    {
        var variant = await db.ProductVariants
            .Include(v => v.Product)
            .ThenInclude(p => p!.Category)
            .Include(v => v.Product)
            .ThenInclude(p => p!.Brand)
            .FirstOrDefaultAsync(v => v.Sku == line.Sku);

        if (variant == null || !variant.IsActive || variant.Product == null || !variant.Product.IsPublished)
        {
            validatedItems.Add(new
            {
                sku = line.Sku,
                quantity = line.Quantity,
                isValid = false,
                errorMessage = "Sản phẩm không tồn tại hoặc đã ngừng kinh doanh."
            });
            continue;
        }

        var balance = await db.InventoryBalances.FirstOrDefaultAsync(b => b.Sku == line.Sku);
        var available = balance?.AvailableStock ?? 0;
        var requestedQty = Math.Max(1, line.Quantity);
        var lineTotal = variant.Price * requestedQty;
        totalAmount += lineTotal;

        validatedItems.Add(new
        {
            sku = variant.Sku,
            productId = variant.ProductId,
            productName = variant.Product.Name,
            variantName = variant.Name,
            imageUrl = variant.ImageUrl ?? variant.Product.ImageUrl,
            price = variant.Price,
            quantity = requestedQty,
            lineTotal,
            availableStock = available,
            isValid = available >= requestedQty,
            errorMessage = available < requestedQty ? $"Chỉ còn {available} sản phẩm khả dụng." : null
        });
    }

    return Results.Ok(new { items = validatedItems, totalAmount, allValid = validatedItems.All(i => (bool)((dynamic)i).isValid) });
});

app.MapPost("/api/promotions/validate", async (PromotionValidateRequest req, CatalogDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.Code))
        return Results.BadRequest(new { message = "Vui lòng nhập mã khuyến mãi." });
    if (req.Items is null || req.Items.Count == 0 || req.Items.Any(i => i.Quantity <= 0))
        return Results.BadRequest(new { message = "Giỏ hàng hoặc số lượng sản phẩm không hợp lệ." });

    decimal subtotal = 0;
    foreach (var line in req.Items)
    {
        var variant = await db.ProductVariants.Include(v => v.Product)
            .SingleOrDefaultAsync(v => v.Sku == line.Sku && v.IsActive && v.Product!.IsPublished);
        if (variant is null)
            return Results.BadRequest(new { message = $"Sản phẩm {line.Sku} không còn hoạt động." });
        subtotal += variant.Price * line.Quantity;
    }

    var code = req.Code.Trim().ToUpperInvariant();
    var promotion = await db.Promotions.AsNoTracking().SingleOrDefaultAsync(p => p.Code == code);
    if (promotion is null) return Results.NotFound(new { message = "Mã khuyến mãi không tồn tại." });
    var error = GetPromotionError(promotion, subtotal, DateTime.UtcNow);
    if (error is not null) return Results.BadRequest(new { message = error });

    var discountAmount = promotion.CalculateDiscount(subtotal);
    return Results.Ok(new
    {
        promotion.Code,
        promotion.Description,
        subtotal,
        discountAmount,
        totalAmount = subtotal - discountAmount
    });
});

// ==========================================
// MODULE 5: CHECKOUT & ORDER MANAGEMENT
// ==========================================
app.MapPost("/api/orders", async (CreateOrderRequest req, HttpContext context, CatalogDbContext db) =>
{
    var currentUser = GetCurrentUser(context);
    if (string.IsNullOrWhiteSpace(req.CustomerName) || string.IsNullOrWhiteSpace(req.CustomerPhone) || string.IsNullOrWhiteSpace(req.ShippingAddress))
        return Results.BadRequest(new { message = "Vui lòng điền họ tên, số điện thoại và địa chỉ nhận hàng." });

    if (req.Items == null || req.Items.Count == 0)
        return Results.BadRequest(new { message = "Giỏ hàng rỗng, không thể tạo đơn hàng." });
    if (req.Items.Any(i => i.Quantity <= 0))
        return Results.BadRequest(new { message = "Số lượng sản phẩm phải là số nguyên dương." });

    // Idempotency check
    var idempotencyKey = context.Request.Headers["Idempotency-Key"].FirstOrDefault();
    var requestHash = GetOrderRequestHash(req);
    if (!string.IsNullOrWhiteSpace(idempotencyKey))
    {
        var existingOrder = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.IdempotencyKey == idempotencyKey);
        if (existingOrder != null)
            return existingOrder.RequestHash == requestHash
                ? Results.Ok(new { message = "Đơn hàng đã được tạo trước đó.", order = existingOrder })
                : Results.Conflict(new { message = "Idempotency-Key đã được dùng cho nội dung đơn hàng khác." });
    }

    // Atomic transaction for order creation and inventory reservation
    await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
    try
    {
        var orderItems = new List<OrderItem>();
        decimal calculatedTotal = 0;

        foreach (var line in req.Items)
        {
            var variant = await db.ProductVariants.Include(v => v.Product).FirstOrDefaultAsync(v => v.Sku == line.Sku);
            if (variant == null || !variant.IsActive || variant.Product == null || !variant.Product.IsPublished)
                return Results.BadRequest(new { message = $"Sản phẩm {line.Sku} không còn hoạt động." });

            var balance = await db.InventoryBalances.FirstOrDefaultAsync(b => b.Sku == line.Sku);
            if (balance == null)
            {
                balance = new InventoryBalance { Sku = line.Sku, WarehouseCode = "WH-CENTRAL", P = 100, B = 10 };
                db.InventoryBalances.Add(balance);
                await db.SaveChangesAsync();
            }

            // Invariant: U = P - Q - B - R - A must be >= requested quantity
            var available = balance.AvailableStock;
            if (available < line.Quantity)
            {
                await transaction.RollbackAsync();
                return Results.Conflict(new { message = $"Sản phẩm '{variant.Product.Name}' không đủ số lượng tồn khả dụng (còn lại: {available}, yêu cầu: {line.Quantity})." });
            }

            // Reserve stock: increase R atomically
            balance.R += line.Quantity;

            var lineTotal = variant.Price * line.Quantity;
            calculatedTotal += lineTotal;

            orderItems.Add(new OrderItem
            {
                ProductId = variant.ProductId,
                VariantId = variant.Id,
                Sku = variant.Sku,
                ProductName = variant.Product.Name,
                VariantName = variant.Name,
                UnitPrice = variant.Price,
                Quantity = line.Quantity,
                LineTotal = lineTotal
            });
        }

        Promotion? promotion = null;
        decimal discountAmount = 0;
        if (!string.IsNullOrWhiteSpace(req.PromotionCode))
        {
            var normalizedCode = req.PromotionCode.Trim().ToUpperInvariant();
            promotion = await db.Promotions.SingleOrDefaultAsync(p => p.Code == normalizedCode);
            if (promotion is null)
            {
                await transaction.RollbackAsync();
                return Results.BadRequest(new { message = "Mã khuyến mãi không tồn tại." });
            }
            var promotionError = GetPromotionError(promotion, calculatedTotal, DateTime.UtcNow);
            if (promotionError is not null)
            {
                await transaction.RollbackAsync();
                return Results.BadRequest(new { message = promotionError });
            }
            discountAmount = promotion.CalculateDiscount(calculatedTotal);
            promotion.UsedCount += 1;
        }

        var orderCode = $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(10000, 99999)}";
        var order = new Order
        {
            OrderCode = orderCode,
            UserId = currentUser?.Id,
            CustomerName = req.CustomerName.Trim(),
            CustomerEmail = req.CustomerEmail?.Trim() ?? currentUser?.Email ?? $"{orderCode}@guest.local",
            CustomerPhone = req.CustomerPhone.Trim(),
            ShippingAddress = req.ShippingAddress.Trim(),
            PaymentMethod = req.PaymentMethod ?? "COD",
            PaymentStatus = "Pending",
            Status = "Pending",
            SubtotalAmount = calculatedTotal,
            DiscountAmount = discountAmount,
            TotalAmount = calculatedTotal - discountAmount,
            PromotionId = promotion?.Id,
            PromotionCode = promotion?.Code,
            Note = req.Note?.Trim(),
            IdempotencyKey = idempotencyKey,
            RequestHash = requestHash,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = orderItems,
            StatusHistories = new List<OrderStatusHistory>
            {
                new OrderStatusHistory
                {
                    FromStatus = "New",
                    ToStatus = "Pending",
                    Actor = currentUser?.FullName ?? req.CustomerName,
                    Note = "Đơn hàng được khởi tạo và giữ hàng thành công."
                }
            }
        };

        db.Orders.Add(order);
        await db.SaveChangesAsync();

        // Create reservations and ledger entries
        foreach (var item in orderItems)
        {
            db.InventoryReservations.Add(new InventoryReservation
            {
                OrderId = order.Id,
                Sku = item.Sku,
                Quantity = item.Quantity,
                Status = "Active"
            });

            db.InventoryLedgers.Add(new InventoryLedger
            {
                TransactionCode = orderCode,
                Sku = item.Sku,
                MovementType = "Reserve",
                DeltaR = item.Quantity,
                Reason = $"Giữ hàng cho đơn {orderCode}",
                Actor = currentUser?.Email ?? "Customer"
            });
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();

        return Results.Ok(new
        {
            message = "Đặt hàng thành công!",
            order = new
            {
                order.Id,
                order.OrderCode,
                order.TotalAmount,
                order.SubtotalAmount,
                order.DiscountAmount,
                order.PromotionCode,
                order.Status,
                order.CustomerName,
                order.ShippingAddress,
                order.CreatedAt,
                itemCount = order.Items.Count
            }
        });
    }
    catch (DbUpdateException) when (!string.IsNullOrWhiteSpace(idempotencyKey))
    {
        await transaction.RollbackAsync();
        db.ChangeTracker.Clear();
        var existing = await db.Orders.Include(o => o.Items).SingleOrDefaultAsync(o => o.IdempotencyKey == idempotencyKey);
        if (existing is not null && existing.RequestHash == requestHash)
            return Results.Ok(new { message = "Đơn hàng đã được tạo trước đó.", order = existing });
        return Results.Conflict(new { message = "Idempotency-Key đã được dùng hoặc đơn hàng đang được xử lý." });
    }
    catch (Exception)
    {
        await transaction.RollbackAsync();
        return Results.Problem(detail: "Không thể tạo đơn hàng. Vui lòng thử lại.");
    }
});

app.MapGet("/api/me/orders", async (HttpContext context, CatalogDbContext db) =>
{
    var currentUser = GetCurrentUser(context);
    if (currentUser == null) return Results.StatusCode(StatusCodes.Status401Unauthorized);

    var orders = await db.Orders
        .AsNoTracking()
        .Include(o => o.Items)
        .Where(o => o.UserId == currentUser.Id || o.CustomerEmail == currentUser.Email)
        .OrderByDescending(o => o.CreatedAt)
        .Select(o => new
        {
            o.Id,
            o.OrderCode,
            o.Status,
            o.PaymentMethod,
            o.PaymentStatus,
            o.TotalAmount,
            o.CreatedAt,
            items = o.Items.Select(i => new { i.Id, i.ProductName, i.VariantName, i.Sku, i.UnitPrice, i.Quantity, i.LineTotal })
        })
        .ToListAsync();

    return Results.Ok(orders);
});

app.MapGet("/api/orders/{codeOrId}", async (string codeOrId, CatalogDbContext db) =>
{
    var query = db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.StatusHistories);
    Order? order;

    if (int.TryParse(codeOrId, out var id))
        order = await query.FirstOrDefaultAsync(o => o.Id == id || o.OrderCode == codeOrId);
    else
        order = await query.FirstOrDefaultAsync(o => o.OrderCode == codeOrId);

    if (order == null) return Results.NotFound(new { message = "Không tìm thấy đơn hàng." });

    return Results.Ok(new
    {
        order.Id,
        order.OrderCode,
        order.CustomerName,
        order.CustomerEmail,
        order.CustomerPhone,
        order.ShippingAddress,
        order.PaymentMethod,
        order.PaymentStatus,
        order.Status,
        order.TotalAmount,
        order.Note,
        order.CreatedAt,
        items = order.Items.Select(i => new { i.Id, i.ProductId, i.ProductName, i.VariantName, i.Sku, i.UnitPrice, i.Quantity, i.LineTotal }),
        timeline = order.StatusHistories.OrderBy(h => h.CreatedAt).Select(h => new { h.FromStatus, h.ToStatus, h.Actor, h.Note, h.CreatedAt })
    });
});

app.MapPost("/api/orders/{id:int}/cancel", async (int id, CancelOrderRequest req, HttpContext context, CatalogDbContext db) =>
{
    var currentUser = GetCurrentUser(context);
    await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

    var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
    if (order == null) return Results.NotFound(new { message = "Không tìm thấy đơn hàng." });

    if (order.Status is "Shipped" or "Delivered" or "Cancelled")
        return Results.BadRequest(new { message = $"Không thể hủy đơn hàng đang ở trạng thái '{order.Status}'." });

    var fromStatus = order.Status;
    order.Status = "Cancelled";
    order.UpdatedAt = DateTime.UtcNow;

    // Release reservation R: reduce R
    foreach (var item in order.Items)
    {
        var balance = await db.InventoryBalances.FirstOrDefaultAsync(b => b.Sku == item.Sku);
        if (balance != null)
        {
            balance.R = Math.Max(0, balance.R - item.Quantity);
        }

        var res = await db.InventoryReservations.FirstOrDefaultAsync(r => r.OrderId == order.Id && r.Sku == item.Sku && r.Status == "Active");
        if (res != null) res.Status = "Released";

        db.InventoryLedgers.Add(new InventoryLedger
        {
            TransactionCode = order.OrderCode,
            Sku = item.Sku,
            MovementType = "Release",
            DeltaR = -item.Quantity,
            Reason = req.Reason ?? "Hủy đơn hàng và giải phóng tồn giữ",
            Actor = currentUser?.FullName ?? "User"
        });
    }

    db.OrderStatusHistories.Add(new OrderStatusHistory
    {
        OrderId = order.Id,
        FromStatus = fromStatus,
        ToStatus = "Cancelled",
        Actor = currentUser?.FullName ?? "User",
        Note = req.Reason ?? "Khách hàng/Nhân viên yêu cầu hủy đơn."
    });

    await db.SaveChangesAsync();
    await transaction.CommitAsync();

    return Results.Ok(new { message = "Hủy đơn hàng và giải phóng tồn kho thành công.", status = "Cancelled" });
});

app.MapGet("/api/admin/orders", async (string? status, string? q, int? page, int? pageSize, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Sales");
    if (authRes != null) return authRes;

    var query = db.Orders.AsNoTracking().Include(o => o.Items).AsQueryable();
    if (!string.IsNullOrWhiteSpace(status)) query = query.Where(o => o.Status == status);
    if (!string.IsNullOrWhiteSpace(q))
    {
        var term = q.Trim();
        query = query.Where(o => o.OrderCode.Contains(term) || o.CustomerName.Contains(term) || o.CustomerPhone.Contains(term));
    }

    var total = await query.CountAsync();
    var p = Math.Max(1, page ?? 1);
    var ps = Math.Clamp(pageSize ?? 20, 1, 100);

    var items = await query.OrderByDescending(o => o.CreatedAt)
        .Skip((p - 1) * ps).Take(ps)
        .Select(o => new
        {
            o.Id,
            o.OrderCode,
            o.CustomerName,
            o.CustomerPhone,
            o.TotalAmount,
            o.Status,
            o.PaymentMethod,
            o.PaymentStatus,
            o.CreatedAt,
            itemCount = o.Items.Count
        })
        .ToListAsync();

    return Results.Ok(new { items, total, page = p, pageSize = ps });
});

app.MapPost("/api/admin/orders/{id:int}/confirm", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Sales");
    if (authRes != null) return authRes;

    var order = await db.Orders.FindAsync(id);
    if (order == null) return Results.NotFound();

    if (order.Status != "Pending")
        return Results.BadRequest(new { message = $"Đơn hàng đang ở trạng thái '{order.Status}', không thể xác nhận." });

    order.Status = "Confirmed";
    order.UpdatedAt = DateTime.UtcNow;

    db.OrderStatusHistories.Add(new OrderStatusHistory
    {
        OrderId = order.Id,
        FromStatus = "Pending",
        ToStatus = "Confirmed",
        Actor = staff.FullName,
        Note = "Nhân viên bán hàng đã duyệt và xác nhận đơn."
    });

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Xác nhận đơn hàng thành công.", status = "Confirmed" });
});

// ==========================================
// MODULE 6: INVENTORY & FULFILLMENT
// ==========================================
app.MapGet("/api/admin/inventory", async (HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Warehouse");
    if (authRes != null) return authRes;

    var balances = await db.InventoryBalances
        .AsNoTracking()
        .OrderBy(b => b.Sku)
        .Select(b => new
        {
            b.Id,
            b.Sku,
            b.WarehouseCode,
            b.P,
            b.Q,
            b.B,
            b.R,
            b.A,
            availableStock = b.P - b.Q - b.B - b.R - b.A,
            isLowStock = (b.P - b.Q - b.B - b.R - b.A) <= b.B
        })
        .ToListAsync();

    return Results.Ok(balances);
});

app.MapPost("/api/admin/orders/{id:int}/fulfill", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Warehouse");
    if (authRes != null) return authRes;

    await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
    var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);
    if (order == null) return Results.NotFound();

    if (order.Status is not ("Pending" or "Confirmed"))
        return Results.BadRequest(new { message = $"Đơn hàng ở trạng thái '{order.Status}', không thể xuất kho." });

    var fromStatus = order.Status;
    order.Status = "Shipped";
    order.UpdatedAt = DateTime.UtcNow;

    // Fulfillment: Reduce P and Reduce R
    foreach (var item in order.Items)
    {
        var balance = await db.InventoryBalances.FirstOrDefaultAsync(b => b.Sku == item.Sku);
        if (balance != null)
        {
            balance.P = Math.Max(0, balance.P - item.Quantity);
            balance.R = Math.Max(0, balance.R - item.Quantity);
        }

        var res = await db.InventoryReservations.FirstOrDefaultAsync(r => r.OrderId == order.Id && r.Sku == item.Sku && r.Status == "Active");
        if (res != null) res.Status = "Fulfilled";

        db.InventoryLedgers.Add(new InventoryLedger
        {
            TransactionCode = order.OrderCode,
            Sku = item.Sku,
            MovementType = "Issue",
            DeltaP = -item.Quantity,
            DeltaR = -item.Quantity,
            Reason = $"Xuất kho giao hàng cho đơn {order.OrderCode}",
            Actor = staff.FullName
        });
    }

    db.OrderStatusHistories.Add(new OrderStatusHistory
    {
        OrderId = order.Id,
        FromStatus = fromStatus,
        ToStatus = "Shipped",
        Actor = staff.FullName,
        Note = "Kho đã soạn hàng và bàn giao cho đơn vị vận chuyển."
    });

    await db.SaveChangesAsync();
    await transaction.CommitAsync();

    return Results.Ok(new { message = "Xuất kho thành công. Đơn hàng chuyển sang 'Đang giao hàng'.", status = "Shipped" });
});

app.MapPost("/api/admin/orders/{id:int}/deliver", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Warehouse");
    if (authRes != null) return authRes;

    var order = await db.Orders.FindAsync(id);
    if (order == null) return Results.NotFound();

    if (order.Status != "Shipped")
        return Results.BadRequest(new { message = $"Đơn hàng đang ở trạng thái '{order.Status}', không thể đánh dấu giao thành công." });

    order.Status = "Delivered";
    order.PaymentStatus = "Paid";
    order.UpdatedAt = DateTime.UtcNow;

    db.OrderStatusHistories.Add(new OrderStatusHistory
    {
        OrderId = order.Id,
        FromStatus = "Shipped",
        ToStatus = "Delivered",
        Actor = staff.FullName,
        Note = "Đơn hàng đã được giao thành công cho khách hàng."
    });

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Đã cập nhật trạng thái 'Giao thành công'.", status = "Delivered" });
});

app.MapPost("/api/admin/inventory/adjust", async (AdjustInventoryRequest req, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Warehouse");
    if (authRes != null) return authRes;

    var balance = await db.InventoryBalances.FirstOrDefaultAsync(b => b.Sku == req.Sku);
    if (balance == null) return Results.NotFound(new { message = "Không tìm thấy số dư cho SKU này." });

    balance.P += req.DeltaP;
    balance.Q += req.DeltaQ;
    balance.B += req.DeltaB;

    db.InventoryLedgers.Add(new InventoryLedger
    {
        TransactionCode = "ADJ-" + Guid.NewGuid().ToString("N")[..8].ToUpper(),
        Sku = req.Sku,
        MovementType = req.DeltaP > 0 ? "Receive" : "Adjustment",
        DeltaP = req.DeltaP,
        DeltaQ = req.DeltaQ,
        DeltaB = req.DeltaB,
        Reason = req.Reason ?? "Điều chỉnh / nhập thêm hàng vào kho",
        Actor = staff.FullName
    });

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Cập nhật tồn kho thành công.", balance });
});

app.MapGet("/api/admin/inventory/ledgers", async (string? sku, int? page, int? pageSize, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Warehouse");
    if (authRes != null) return authRes;

    var query = db.InventoryLedgers.AsNoTracking().AsQueryable();
    if (!string.IsNullOrWhiteSpace(sku)) query = query.Where(l => l.Sku == sku);

    var total = await query.CountAsync();
    var p = Math.Max(1, page ?? 1);
    var ps = Math.Clamp(pageSize ?? 30, 1, 100);

    var items = await query.OrderByDescending(l => l.CreatedAt).Skip((p - 1) * ps).Take(ps).ToListAsync();
    return Results.Ok(new { items, total, page = p, pageSize = ps });
});

// ==========================================
// MODULE 8: RETURNS, REFUNDS & WARRANTY
// ==========================================
app.MapPost("/api/me/returns", async (CreateReturnRequest req, HttpContext context, CatalogDbContext db) =>
{
    var currentUser = GetCurrentUser(context);
    if (currentUser == null) return Results.StatusCode(StatusCodes.Status401Unauthorized);

    var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == req.OrderId);
    if (order == null) return Results.NotFound(new { message = "Không tìm thấy đơn hàng." });

    if (order.Status != "Delivered")
        return Results.BadRequest(new { message = "Chỉ có thể yêu cầu đổi trả cho đơn hàng đã giao thành công." });

    var returnItems = new List<ReturnItem>();
    decimal refundTotal = 0;

    foreach (var itemReq in req.Items)
    {
        var orderItem = order.Items.FirstOrDefault(oi => oi.Id == itemReq.OrderItemId);
        if (orderItem == null || itemReq.Quantity > orderItem.Quantity)
            return Results.BadRequest(new { message = $"Số lượng yêu cầu trả vượt quá số lượng đã mua của dòng hàng." });

        var refundLine = orderItem.UnitPrice * itemReq.Quantity;
        refundTotal += refundLine;

        returnItems.Add(new ReturnItem
        {
            OrderItemId = orderItem.Id,
            Sku = orderItem.Sku,
            Quantity = itemReq.Quantity,
            UnitPrice = orderItem.UnitPrice,
            QCStatus = "Pending",
            Note = itemReq.Note
        });
    }

    var returnCode = $"RMA-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
    var returnReq = new ReturnRequest
    {
        ReturnCode = returnCode,
        OrderId = order.Id,
        CustomerId = currentUser.Id,
        Reason = req.Reason.Trim(),
        Status = "Requested",
        RefundAmount = refundTotal,
        Items = returnItems
    };

    db.ReturnRequests.Add(returnReq);
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Gửi yêu cầu đổi trả thành công.", returnCode, returnId = returnReq.Id });
});

app.MapGet("/api/admin/returns", async (HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "CustomerSupport");
    if (authRes != null) return authRes;

    var returns = await db.ReturnRequests
        .Include(r => r.Items)
        .Include(r => r.Order)
        .OrderByDescending(r => r.CreatedAt)
        .Select(r => new
        {
            r.Id,
            r.ReturnCode,
            orderCode = r.Order!.OrderCode,
            r.Reason,
            r.Status,
            r.QCResult,
            r.RefundAmount,
            r.CreatedAt,
            items = r.Items.Select(i => new { i.Id, i.Sku, i.Quantity, i.UnitPrice, i.QCStatus, i.Note })
        })
        .ToListAsync();

    return Results.Ok(returns);
});

app.MapPost("/api/admin/returns/{id:int}/approve", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "CustomerSupport");
    if (authRes != null) return authRes;

    var ret = await db.ReturnRequests.FindAsync(id);
    if (ret == null) return Results.NotFound();

    ret.Status = "Approved";
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Đã phê duyệt yêu cầu đổi trả.", status = "Approved" });
});

app.MapPost("/api/admin/returns/{id:int}/receive", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Warehouse");
    if (authRes != null) return authRes;

    var ret = await db.ReturnRequests.Include(r => r.Items).FirstOrDefaultAsync(r => r.Id == id);
    if (ret == null) return Results.NotFound();

    // Goods physically arrive at warehouse: increase P and Q (quarantined awaiting QC)
    foreach (var item in ret.Items)
    {
        var balance = await db.InventoryBalances.FirstOrDefaultAsync(b => b.Sku == item.Sku);
        if (balance != null)
        {
            balance.P += item.Quantity;
            balance.Q += item.Quantity; // Quarantined, available U does not change!
        }

        db.InventoryLedgers.Add(new InventoryLedger
        {
            TransactionCode = ret.ReturnCode,
            Sku = item.Sku,
            MovementType = "Quarantine_Receive",
            DeltaP = item.Quantity,
            DeltaQ = item.Quantity,
            Reason = $"Tiếp nhận hàng hoàn chờ kiểm định QC ({ret.ReturnCode})",
            Actor = staff.FullName
        });
    }

    ret.Status = "Received";
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Đã tiếp nhận hàng hoàn vào khu cách ly. Chờ nhân viên QC kiểm định.", status = "Received" });
});

app.MapPost("/api/admin/returns/{id:int}/qc", async (int id, QCInspectionRequest req, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Warehouse");
    if (authRes != null) return authRes;

    var ret = await db.ReturnRequests.Include(r => r.Items).FirstOrDefaultAsync(r => r.Id == id);
    if (ret == null) return Results.NotFound();

    // If passed: reduce Q (which makes U increase!)
    // If failed: reduce P and Q (goods scrapped)
    foreach (var item in ret.Items)
    {
        var balance = await db.InventoryBalances.FirstOrDefaultAsync(b => b.Sku == item.Sku);
        if (req.IsPassed)
        {
            item.QCStatus = "Passed";
            if (balance != null) balance.Q = Math.Max(0, balance.Q - item.Quantity); // Releases from quarantine to U!

            db.InventoryLedgers.Add(new InventoryLedger
            {
                TransactionCode = ret.ReturnCode,
                Sku = item.Sku,
                MovementType = "QC_Pass",
                DeltaQ = -item.Quantity,
                Reason = "Kiểm định đạt chuẩn: chuyển hàng vào kho bán lại (tăng tồn khả dụng U)",
                Actor = staff.FullName
            });
        }
        else
        {
            item.QCStatus = "Failed";
            if (balance != null)
            {
                balance.P = Math.Max(0, balance.P - item.Quantity);
                balance.Q = Math.Max(0, balance.Q - item.Quantity);
            }

            db.InventoryLedgers.Add(new InventoryLedger
            {
                TransactionCode = ret.ReturnCode,
                Sku = item.Sku,
                MovementType = "QC_Fail",
                DeltaP = -item.Quantity,
                DeltaQ = -item.Quantity,
                Reason = "Kiểm định không đạt: tiêu hủy hàng hỏng",
                Actor = staff.FullName
            });
        }
    }

    ret.Status = "QC_Completed";
    ret.QCResult = req.IsPassed ? "Passed" : "Failed";
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Hoàn tất kiểm định QC.", status = "QC_Completed", qcResult = ret.QCResult });
});

app.MapPost("/api/admin/returns/{id:int}/refund", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Admin");
    if (authRes != null) return authRes;

    var ret = await db.ReturnRequests.Include(r => r.Order).FirstOrDefaultAsync(r => r.Id == id);
    if (ret == null) return Results.NotFound();

    ret.Status = "Refunded";
    if (ret.Order != null) ret.Order.PaymentStatus = "Refunded";

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Đã hoàn tất thủ tục hoàn tiền cho khách hàng.", status = "Refunded" });
});

// ==========================================
// MODULE 9: CUSTOMER SUPPORT (TICKETS)
// ==========================================
app.MapPost("/api/me/tickets", async (CreateTicketRequest req, HttpContext context, CatalogDbContext db) =>
{
    var currentUser = GetCurrentUser(context);
    if (string.IsNullOrWhiteSpace(req.Subject) || string.IsNullOrWhiteSpace(req.Message))
        return Results.BadRequest(new { message = "Vui lòng nhập tiêu đề và nội dung cần hỗ trợ." });

    var ticketCode = $"TCK-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
    var ticket = new SupportTicket
    {
        TicketCode = ticketCode,
        CustomerId = currentUser?.Id,
        CustomerName = currentUser?.FullName ?? req.CustomerName ?? "Khách hàng",
        CustomerEmail = currentUser?.Email ?? req.CustomerEmail ?? "guest@support.local",
        Subject = req.Subject.Trim(),
        Category = req.Category ?? "General",
        Priority = req.Priority ?? "Medium",
        Status = "Open",
        RelatedOrderId = req.RelatedOrderId,
        Messages = new List<TicketMessage>
        {
            new TicketMessage
            {
                SenderName = currentUser?.FullName ?? req.CustomerName ?? "Khách hàng",
                SenderRole = "Customer",
                Message = req.Message.Trim()
            }
        }
    };

    db.SupportTickets.Add(ticket);
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Gửi yêu cầu hỗ trợ thành công.", ticketCode, ticketId = ticket.Id });
});

app.MapGet("/api/me/tickets", async (HttpContext context, CatalogDbContext db) =>
{
    var currentUser = GetCurrentUser(context);
    if (currentUser == null) return Results.StatusCode(StatusCodes.Status401Unauthorized);

    var tickets = await db.SupportTickets
        .AsNoTracking()
        .Where(t => t.CustomerId == currentUser.Id || t.CustomerEmail == currentUser.Email)
        .OrderByDescending(t => t.CreatedAt)
        .Select(t => new { t.Id, t.TicketCode, t.Subject, t.Category, t.Priority, t.Status, t.CreatedAt, messageCount = t.Messages.Count })
        .ToListAsync();

    return Results.Ok(tickets);
});

app.MapGet("/api/admin/tickets", async (string? status, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "CustomerSupport");
    if (authRes != null) return authRes;

    var query = db.SupportTickets.AsNoTracking().AsQueryable();
    if (!string.IsNullOrWhiteSpace(status)) query = query.Where(t => t.Status == status);

    var tickets = await query.OrderByDescending(t => t.CreatedAt)
        .Select(t => new { t.Id, t.TicketCode, t.CustomerName, t.CustomerEmail, t.Subject, t.Category, t.Priority, t.Status, t.CreatedAt })
        .ToListAsync();

    return Results.Ok(tickets);
});

app.MapGet("/api/tickets/{id:int}", async (int id, CatalogDbContext db) =>
{
    var ticket = await db.SupportTickets.Include(t => t.Messages).FirstOrDefaultAsync(t => t.Id == id);
    if (ticket == null) return Results.NotFound();

    return Results.Ok(new
    {
        ticket.Id,
        ticket.TicketCode,
        ticket.CustomerName,
        ticket.CustomerEmail,
        ticket.Subject,
        ticket.Category,
        ticket.Priority,
        ticket.Status,
        ticket.RelatedOrderId,
        ticket.CreatedAt,
        messages = ticket.Messages.OrderBy(m => m.CreatedAt).Select(m => new { m.Id, m.SenderName, m.SenderRole, m.Message, m.CreatedAt })
    });
});

app.MapPost("/api/tickets/{id:int}/reply", async (int id, ReplyTicketRequest req, HttpContext context, CatalogDbContext db) =>
{
    var ticket = await db.SupportTickets.Include(t => t.Messages).FirstOrDefaultAsync(t => t.Id == id);
    if (ticket == null) return Results.NotFound();

    var currentUser = GetCurrentUser(context);
    var senderRole = (currentUser != null && currentUser.Role != "Customer") ? "Staff" : "Customer";
    var senderName = currentUser?.FullName ?? req.SenderName ?? (senderRole == "Staff" ? "Nhân viên CSKH" : "Khách hàng");

    ticket.Messages.Add(new TicketMessage
    {
        TicketId = ticket.Id,
        SenderName = senderName,
        SenderRole = senderRole,
        Message = req.Message.Trim()
    });

    if (senderRole == "Staff" && ticket.Status == "Open")
        ticket.Status = "InProgress";

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Phản hồi đã được gửi.", ticketStatus = ticket.Status });
});

app.MapPut("/api/tickets/{id:int}/status", async (int id, UpdateTicketStatusRequest req, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "CustomerSupport");
    if (authRes != null) return authRes;

    var ticket = await db.SupportTickets.FindAsync(id);
    if (ticket == null) return Results.NotFound();

    ticket.Status = req.Status;
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Đã cập nhật trạng thái ticket.", status = ticket.Status });
});

// ==========================================
// MODULE 10: ADMIN DASHBOARD & REPORTING
// ==========================================
app.MapGet("/api/admin/dashboard", async (HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Sales");
    if (authRes != null) return authRes;

    var totalProducts = await db.Products.CountAsync(p => p.IsPublished);
    var totalOrders = await db.Orders.CountAsync();
    var totalRevenue = await db.Orders.Where(o => o.Status != "Cancelled").SumAsync(o => (decimal?)o.TotalAmount) ?? 0;

    var pendingOrders = await db.Orders.CountAsync(o => o.Status == "Pending" || o.Status == "Confirmed");
    var shippedOrders = await db.Orders.CountAsync(o => o.Status == "Shipped");
    var deliveredOrders = await db.Orders.CountAsync(o => o.Status == "Delivered");
    var cancelledOrders = await db.Orders.CountAsync(o => o.Status == "Cancelled");

    var lowStockAlerts = await db.InventoryBalances
        .CountAsync(b => (b.P - b.Q - b.B - b.R - b.A) <= b.B);

    var pendingReturns = await db.ReturnRequests.CountAsync(r => r.Status == "Requested" || r.Status == "Approved" || r.Status == "Received");
    var openTickets = await db.SupportTickets.CountAsync(t => t.Status == "Open" || t.Status == "InProgress");

    var recentOrders = await db.Orders.OrderByDescending(o => o.CreatedAt).Take(5)
        .Select(o => new { o.Id, o.OrderCode, o.CustomerName, o.TotalAmount, o.Status, o.CreatedAt })
        .ToListAsync();

    return Results.Ok(new
    {
        totalProducts,
        totalOrders,
        totalRevenue,
        pendingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        lowStockAlerts,
        pendingReturns,
        openTickets,
        recentOrders
    });
});

app.Run();

// DTO Definitions
public sealed record RegisterRequest(string Email, string Password, string FullName, string? PhoneNumber);
public sealed record LoginRequest(string Email, string Password);
public sealed record UpdateProfileRequest(string? FullName, string? PhoneNumber);
public sealed record SaveAddressRequest(string RecipientName, string PhoneNumber, string StreetAddress, string? Ward, string? District, string City);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record CreateProductRequest(string Name, string? Sku, decimal Price, int CategoryId, int? BrandId, string? Description, string? ImageUrl, string? PackageSize, string? SaleUnit, bool IsPublished = true, bool IsFeatured = false);
public sealed record UpdateProductRequest(string? Name, decimal? Price, int? CategoryId, int? BrandId, string? Description, string? ImageUrl, string? PackageSize, string? SaleUnit, bool? IsPublished, bool? IsFeatured);

public sealed record CartItemRequest(string Sku, int Quantity);
public sealed record CartValidateRequest(List<CartItemRequest> Items);

public sealed record CreateOrderRequest(string CustomerName, string? CustomerEmail, string CustomerPhone, string ShippingAddress, string? PaymentMethod, string? Note, List<CartItemRequest> Items, string? PromotionCode = null);
public sealed record PromotionValidateRequest(string Code, List<CartItemRequest> Items);
public sealed record CancelOrderRequest(string? Reason);

public sealed record AdjustInventoryRequest(string Sku, int DeltaP, int DeltaQ = 0, int DeltaB = 0, string? Reason = null);

public sealed record CreateReturnItemRequest(int OrderItemId, int Quantity, string? Note);
public sealed record CreateReturnRequest(int OrderId, string Reason, List<CreateReturnItemRequest> Items);
public sealed record QCInspectionRequest(bool IsPassed, string? Note);

public sealed record CreateTicketRequest(string? CustomerName, string? CustomerEmail, string Subject, string? Category, string? Priority, string Message, int? RelatedOrderId);
public sealed record ReplyTicketRequest(string Message, string? SenderName);
public sealed record UpdateTicketStatusRequest(string Status);
