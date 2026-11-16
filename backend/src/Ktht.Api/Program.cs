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

// TASK-010: nhân viên vận hành được xem đơn của mọi khách; Customer chỉ xem đơn của mình.
static bool IsStaff(AuthUserClaims user) =>
    user.Role is "Sales" or "Warehouse" or "CustomerSupport" or "Admin";

static bool CanCancelAsStaff(AuthUserClaims user) =>
    user.Role is "Sales" or "Admin";

// Deadlock (1205), snapshot/serialization (3960) hoặc vi phạm unique (2601/2627) từ SQL Server, kể cả khi EF bọc trong DbUpdateException.
static bool IsConcurrencyConflict(Exception ex)
{
    for (var current = ex; current != null; current = current.InnerException)
        if (current is Microsoft.Data.SqlClient.SqlException sql && sql.Number is 1205 or 3960 or 2601 or 2627)
            return true;
    return false;
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

        // Check if item is in active flash sale
        var now = DateTime.UtcNow;
        var flashItem = await db.FlashSaleItems
            .Include(fsi => fsi.FlashSale)
            .Where(fsi => fsi.VariantId == variant.Id
                          && fsi.FlashSale!.IsActive
                          && fsi.FlashSale.StartTime <= now
                          && now <= fsi.FlashSale.EndTime
                          && (fsi.QuantityLimit - fsi.SoldCount) >= requestedQty) // R-002: cùng điều kiện với POST /api/orders
            .FirstOrDefaultAsync();

        var unitPrice = flashItem != null ? flashItem.FlashSalePrice : variant.Price;
        var isFlashSale = flashItem != null;
        var lineTotal = unitPrice * requestedQty;
        totalAmount += lineTotal;

        validatedItems.Add(new
        {
            sku = variant.Sku,
            productId = variant.ProductId,
            productName = variant.Product.Name,
            variantName = variant.Name,
            imageUrl = variant.ImageUrl ?? variant.Product.ImageUrl,
            price = unitPrice,
            originalPrice = variant.Price,
            isFlashSale,
            flashSaleDiscount = flashItem?.DiscountPercentage ?? 0,
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

    var now = DateTime.UtcNow;
    decimal subtotal = 0;
    foreach (var line in req.Items)
    {
        var variant = await db.ProductVariants.Include(v => v.Product)
            .SingleOrDefaultAsync(v => v.Sku == line.Sku && v.IsActive && v.Product!.IsPublished);
        if (variant is null)
            return Results.BadRequest(new { message = $"Sản phẩm {line.Sku} không còn hoạt động." });

        var flashItem = await db.FlashSaleItems
            .Include(fsi => fsi.FlashSale)
            .Where(fsi => fsi.VariantId == variant.Id
                          && fsi.FlashSale!.IsActive
                          && fsi.FlashSale.StartTime <= now
                          && now <= fsi.FlashSale.EndTime
                          && (fsi.QuantityLimit - fsi.SoldCount) >= line.Quantity) // R-002: cùng điều kiện với POST /api/orders
            .FirstOrDefaultAsync();

        var unitPrice = flashItem != null ? flashItem.FlashSalePrice : variant.Price;
        subtotal += unitPrice * line.Quantity;
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
    // TASK-010 (F-001/F-002): đặt hàng bắt buộc đăng nhập để đơn luôn có chủ và chỉ chủ đơn xem/hủy được.
    var currentUser = GetCurrentUser(context);
    if (currentUser == null)
        return Results.Json(new { message = "Vui lòng đăng nhập để đặt hàng." }, statusCode: StatusCodes.Status401Unauthorized);
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
            return existingOrder.UserId == currentUser.Id && existingOrder.RequestHash == requestHash
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
                // F-003: không tự sinh tồn kho cho SKU chưa có bản ghi; từ chối và giữ nguyên dữ liệu.
                await transaction.RollbackAsync();
                return Results.Conflict(new { message = $"Sản phẩm '{variant.Product.Name}' chưa có dữ liệu tồn kho nên chưa thể đặt hàng." });
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

            // Check if item is in active flash sale with quota
            var now = DateTime.UtcNow;
            var flashItem = await db.FlashSaleItems
                .Include(fsi => fsi.FlashSale)
                .Where(fsi => fsi.VariantId == variant.Id
                              && fsi.FlashSale!.IsActive
                              && fsi.FlashSale.StartTime <= now
                              && now <= fsi.FlashSale.EndTime
                              && (fsi.QuantityLimit - fsi.SoldCount) >= line.Quantity)
                .FirstOrDefaultAsync();

            var unitPrice = flashItem != null ? flashItem.FlashSalePrice : variant.Price;
            if (flashItem != null)
            {
                flashItem.SoldCount += line.Quantity;
            }

            var lineTotal = unitPrice * line.Quantity;
            calculatedTotal += lineTotal;

            orderItems.Add(new OrderItem
            {
                ProductId = variant.ProductId,
                VariantId = variant.Id,
                Sku = variant.Sku,
                ProductName = variant.Product.Name,
                VariantName = variant.Name,
                UnitPrice = unitPrice,
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

app.MapGet("/api/orders/{codeOrId}", async (string codeOrId, HttpContext context, CatalogDbContext db) =>
{
    // F-001: bắt buộc đăng nhập; Customer chỉ thấy đơn của mình (đơn người khác trả 404 để không lộ sự tồn tại).
    var authRes = RequireAuth(context, out var viewer);
    if (authRes != null) return authRes;

    var query = db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.StatusHistories);
    Order? order;

    if (int.TryParse(codeOrId, out var id))
        order = await query.FirstOrDefaultAsync(o => o.Id == id || o.OrderCode == codeOrId);
    else
        order = await query.FirstOrDefaultAsync(o => o.OrderCode == codeOrId);

    if (order == null || (!IsStaff(viewer) && order.UserId != viewer.Id))
        return Results.NotFound(new { message = "Không tìm thấy đơn hàng." });

    var latestReturn = await db.ReturnRequests.AsNoTracking()
        .Where(r => r.OrderId == order.Id)
        .OrderByDescending(r => r.CreatedAt)
        .Select(r => new { r.ReturnCode, r.Status, r.RefundAmount, r.CreatedAt })
        .FirstOrDefaultAsync();

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
        order.SubtotalAmount,
        order.DiscountAmount,
        order.PromotionCode,
        order.TotalAmount,
        order.Note,
        order.CreatedAt,
        items = order.Items.Select(i => new { i.Id, i.ProductId, i.ProductName, i.VariantName, i.Sku, i.UnitPrice, i.Quantity, i.LineTotal }),
        timeline = order.StatusHistories.OrderBy(h => h.CreatedAt).Select(h => new { h.FromStatus, h.ToStatus, h.Actor, h.Note, h.CreatedAt }),
        latestReturn
    });
});

app.MapPost("/api/orders/{id:int}/cancel", async (int id, CancelOrderRequest req, HttpContext context, CatalogDbContext db) =>
{
    // F-002: chỉ chủ đơn (Customer) hoặc Sales/Admin được hủy.
    var authRes = RequireAuth(context, out var currentUser);
    if (authRes != null) return authRes;

    var snapshot = await db.Orders.AsNoTracking().Select(o => new { o.Id, o.UserId, o.Status }).FirstOrDefaultAsync(o => o.Id == id);
    var isOwner = snapshot != null && snapshot.UserId == currentUser.Id;
    if (snapshot == null || (!isOwner && !IsStaff(currentUser))) return Results.NotFound(new { message = "Không tìm thấy đơn hàng." });
    if (!isOwner && !CanCancelAsStaff(currentUser))
        return Results.StatusCode(StatusCodes.Status403Forbidden);

    try
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        // AGENTS §7.3: claim trạng thái bằng conditional update trước; hủy và xuất kho đồng thời chỉ một bên thắng,
        // không vừa xuất vừa giải phóng cùng reservation.
        var claimed = await db.Orders.Where(o => o.Id == id && (o.Status == "Pending" || o.Status == "Confirmed"))
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, "Cancelled").SetProperty(o => o.UpdatedAt, DateTime.UtcNow));
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).FirstAsync(o => o.Id == id);
        if (claimed == 0)
            return Results.BadRequest(new { message = $"Không thể hủy đơn hàng đang ở trạng thái '{order.Status}'." });

        foreach (var item in order.Items)
        {
            // Giải phóng R nguyên tử trong SQL (không đọc-sửa-ghi).
            await db.InventoryBalances.Where(b => b.Sku == item.Sku)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.R, b => b.R - item.Quantity));
            await db.InventoryReservations.Where(r => r.OrderId == id && r.Sku == item.Sku && r.Status == "Active")
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Released"));

            db.InventoryLedgers.Add(new InventoryLedger
            {
                TransactionCode = order.OrderCode,
                Sku = item.Sku,
                MovementType = "Release",
                DeltaR = -item.Quantity,
                Reason = req.Reason ?? "Hủy đơn hàng và giải phóng tồn giữ",
                Actor = currentUser.FullName
            });
        }

        db.OrderStatusHistories.Add(new OrderStatusHistory
        {
            OrderId = id,
            FromStatus = snapshot.Status,
            ToStatus = "Cancelled",
            Actor = currentUser.FullName,
            Note = req.Reason ?? "Khách hàng/Nhân viên yêu cầu hủy đơn."
        });

        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Ok(new { message = "Hủy đơn hàng và giải phóng tồn kho thành công.", status = "Cancelled" });
    }
    catch (Exception ex) when (IsConcurrencyConflict(ex))
    {
        return Results.Conflict(new { message = "Đơn hàng vừa được xử lý ở một phiên khác. Vui lòng tải lại trang." });
    }
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

    await using var transaction = await db.Database.BeginTransactionAsync();
    // TASK-010: Pending -> Confirmed bằng conditional update; không ghi đè đơn vừa bị hủy song song.
    var claimed = await db.Orders.Where(o => o.Id == id && o.Status == "Pending")
        .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, "Confirmed").SetProperty(o => o.UpdatedAt, DateTime.UtcNow));
    var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);
    if (order == null) return Results.NotFound();
    if (claimed == 0)
        return Results.BadRequest(new { message = $"Đơn hàng đang ở trạng thái '{order.Status}', không thể xác nhận." });

    db.OrderStatusHistories.Add(new OrderStatusHistory
    {
        OrderId = id,
        FromStatus = "Pending",
        ToStatus = "Confirmed",
        Actor = staff.FullName,
        Note = "Nhân viên bán hàng đã duyệt và xác nhận đơn."
    });
    await db.SaveChangesAsync();
    await transaction.CommitAsync();
    return Results.Ok(new { message = "Xác nhận đơn hàng thành công.", status = "Confirmed" });
});

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

    try
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var before = await db.Orders.AsNoTracking().Select(o => new { o.Id, o.Status }).FirstOrDefaultAsync(o => o.Id == id);
        if (before == null) return Results.NotFound();
        // AGENTS §7.3: claim Pending/Confirmed -> Shipped trước; cạnh tranh với hủy chỉ một bên thắng.
        var claimed = await db.Orders.Where(o => o.Id == id && (o.Status == "Pending" || o.Status == "Confirmed"))
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, "Shipped").SetProperty(o => o.UpdatedAt, DateTime.UtcNow));
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).FirstAsync(o => o.Id == id);
        if (claimed == 0)
            return Results.BadRequest(new { message = $"Đơn hàng ở trạng thái '{order.Status}', không thể xuất kho." });

        // Fulfillment: giảm P và R nguyên tử trong SQL, đúng một lần cho đơn.
        foreach (var item in order.Items)
        {
            await db.InventoryBalances.Where(b => b.Sku == item.Sku)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.P, b => b.P - item.Quantity).SetProperty(b => b.R, b => b.R - item.Quantity));
            await db.InventoryReservations.Where(r => r.OrderId == id && r.Sku == item.Sku && r.Status == "Active")
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Fulfilled"));

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
            OrderId = id,
            FromStatus = before.Status,
            ToStatus = "Shipped",
            Actor = staff.FullName,
            Note = "Kho đã soạn hàng và bàn giao cho đơn vị vận chuyển."
        });

        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Results.Ok(new { message = "Xuất kho thành công. Đơn hàng chuyển sang 'Đang giao hàng'.", status = "Shipped" });
    }
    catch (Exception ex) when (IsConcurrencyConflict(ex))
    {
        return Results.Conflict(new { message = "Đơn hàng vừa được xử lý ở một phiên khác. Vui lòng tải lại trang." });
    }
});

app.MapPost("/api/admin/orders/{id:int}/deliver", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Warehouse");
    if (authRes != null) return authRes;

    var order = await db.Orders.FindAsync(id);
    if (order == null) return Results.NotFound();

    if (order.Status != "Shipped")
        return Results.BadRequest(new { message = $"Đơn hàng đang ở trạng thái '{order.Status}', không thể đánh dấu giao thành công." });

    // F-004: giao thành công không đồng nghĩa đã đối soát tiền (AGENTS §8); PaymentStatus giữ nguyên tới khi Sales/Admin xác nhận.
    order.Status = "Delivered";
    order.UpdatedAt = DateTime.UtcNow;

    db.OrderStatusHistories.Add(new OrderStatusHistory
    {
        OrderId = order.Id,
        FromStatus = "Shipped",
        ToStatus = "Delivered",
        Actor = staff.FullName,
        Note = "Đơn hàng đã được giao thành công cho khách hàng. Thanh toán chờ đối soát."
    });

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Đã cập nhật trạng thái 'Giao thành công'. Thanh toán chờ đối soát.", status = "Delivered", paymentStatus = order.PaymentStatus });
});

// F-004: đối soát thanh toán tách khỏi giao hàng. Chuyển Pending -> Paid đúng một lần (conditional update).
app.MapPost("/api/admin/orders/{id:int}/confirm-payment", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Sales");
    if (authRes != null) return authRes;

    var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);
    if (order == null) return Results.NotFound(new { message = "Không tìm thấy đơn hàng." });
    if (order.Status != "Delivered")
        return Results.Conflict(new { message = $"Chỉ đối soát thanh toán cho đơn đã giao; đơn đang ở trạng thái '{order.Status}'." });

    await using var transaction = await db.Database.BeginTransactionAsync();
    var updated = await db.Orders.Where(o => o.Id == id && o.Status == "Delivered" && o.PaymentStatus == "Pending")
        .ExecuteUpdateAsync(s => s.SetProperty(o => o.PaymentStatus, "Paid").SetProperty(o => o.UpdatedAt, DateTime.UtcNow));
    if (updated == 0)
        return Results.Conflict(new { message = $"Thanh toán của đơn đang ở trạng thái '{order.PaymentStatus}', không thể xác nhận lại." });

    db.OrderStatusHistories.Add(new OrderStatusHistory
    {
        OrderId = id,
        FromStatus = "Delivered",
        ToStatus = "Delivered",
        Actor = staff.FullName,
        Note = $"Đã đối soát thanh toán ({order.PaymentMethod}): Pending -> Paid."
    });
    await db.SaveChangesAsync();
    await transaction.CommitAsync();
    return Results.Ok(new { message = "Đã xác nhận thu tiền cho đơn hàng.", paymentStatus = "Paid" });
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

    if (string.IsNullOrWhiteSpace(req.Reason))
        return Results.BadRequest(new { message = "Vui lòng nhập lý do đổi trả." });
    var requestedLines = (req.Items ?? []).Select(i => new ReturnLine(i.OrderItemId, i.Quantity)).ToList();
    if (requestedLines.Count == 0 || requestedLines.Any(l => l.Quantity <= 0))
        return Results.BadRequest(new { message = "Yêu cầu đổi trả phải có ít nhất một dòng hàng với số lượng dương." });

    try
    {
        // TASK-010: kiểm tra quyền, trùng RMA và ghi RMA trong cùng transaction Serializable.
        await using var returnTransaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);

        var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == req.OrderId);
        // Không tiết lộ đơn của người khác: trả 404 như đơn không tồn tại.
        if (order == null || order.UserId != currentUser.Id) return Results.NotFound(new { message = "Không tìm thấy đơn hàng." });

        if (order.Status != "Delivered")
            return Results.BadRequest(new { message = "Chỉ có thể yêu cầu đổi trả cho đơn hàng đã giao thành công." });

        // R-004: chưa có bước từ chối RMA trong state table, nên mỗi đơn chỉ có một RMA (kể cả khi QC không đạt).
        var existingReturn = await db.ReturnRequests.AsNoTracking()
            .Where(r => r.OrderId == order.Id)
            .Select(r => r.ReturnCode).FirstOrDefaultAsync();
        if (existingReturn != null)
            return Results.Conflict(new { message = $"Đơn hàng đã có yêu cầu đổi trả {existingReturn}. Bản demo chỉ hỗ trợ một yêu cầu cho mỗi đơn." });

        // R-001: chỉ chấp nhận trả toàn bộ đơn; không dòng trùng, không vượt hay thiếu số lượng đã giao.
        var policyError = ReturnPolicy.ValidateFullOrder(
            order.Items.Select(i => new ReturnLine(i.Id, i.Quantity)).ToList(), requestedLines);
        if (policyError != null) return Results.BadRequest(new { message = policyError });

        var notes = (req.Items ?? []).ToDictionary(i => i.OrderItemId, i => i.Note);
        var returnItems = order.Items.Select(orderItem => new ReturnItem
        {
            OrderItemId = orderItem.Id,
            Sku = orderItem.Sku,
            Quantity = orderItem.Quantity,
            UnitPrice = orderItem.UnitPrice,
            QCStatus = "Pending",
            Note = notes.GetValueOrDefault(orderItem.Id)
        }).ToList();
        var refundTotal = returnItems.Sum(i => i.UnitPrice * i.Quantity);

        // Mã RMA gắn với đơn: không va chạm ngẫu nhiên vì mỗi đơn chỉ có một RMA.
        var returnCode = $"RMA-{order.OrderCode}";
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
        await returnTransaction.CommitAsync();
        return Results.Ok(new { message = "Gửi yêu cầu đổi trả thành công.", returnCode, returnId = returnReq.Id });
    }
    catch (Exception ex) when (IsConcurrencyConflict(ex))
    {
        // R-003: deadlock/serialization/unique conflict ở bất kỳ bước nào của transaction -> 409, không 500.
        return Results.Conflict(new { message = "Yêu cầu đổi trả cho đơn này vừa được xử lý ở một phiên khác. Vui lòng tải lại trang." });
    }
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

    var ret = await db.ReturnRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
    if (ret == null) return Results.NotFound();

    // TASK-010: chỉ duyệt từ Requested; không kéo lùi RMA đã nhận/kiểm định về Approved.
    var claimed = await db.ReturnRequests.Where(r => r.Id == id && r.Status == "Requested")
        .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Approved"));
    if (claimed == 0)
        return Results.Conflict(new { message = $"Yêu cầu đổi trả đang ở trạng thái '{ret.Status}', chỉ duyệt được khi đang chờ duyệt." });
    return Results.Ok(new { message = "Đã phê duyệt yêu cầu đổi trả.", status = "Approved" });
});

app.MapPost("/api/admin/returns/{id:int}/receive", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Warehouse");
    if (authRes != null) return authRes;

    await using var receiveTransaction = await db.Database.BeginTransactionAsync();
    // TASK-010: claim trạng thái trước (conditional update giữ khóa ghi) rồi mới đọc, để request song song
    // không deadlock và chỉ một lần chuyển Approved -> Received thắng; nhận lặp không cộng P, Q hai lần.
    var claimed = await db.ReturnRequests.Where(r => r.Id == id && r.Status == "Approved")
        .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Received"));
    var ret = await db.ReturnRequests.AsNoTracking().Include(r => r.Items).FirstOrDefaultAsync(r => r.Id == id);
    if (ret == null) return Results.NotFound();
    if (claimed == 0)
        return Results.Conflict(new { message = $"Yêu cầu đổi trả đang ở trạng thái '{ret.Status}', chỉ tiếp nhận được khi đã duyệt (Approved)." });

    // Goods physically arrive at warehouse: increase P and Q (quarantined awaiting QC). Cập nhật nguyên tử trong SQL.
    foreach (var item in ret.Items)
    {
        await db.InventoryBalances.Where(b => b.Sku == item.Sku)
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.P, b => b.P + item.Quantity).SetProperty(b => b.Q, b => b.Q + item.Quantity));

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

    await db.SaveChangesAsync();
    await receiveTransaction.CommitAsync();
    return Results.Ok(new { message = "Đã tiếp nhận hàng hoàn vào khu cách ly. Chờ nhân viên QC kiểm định.", status = "Received" });
});

app.MapPost("/api/admin/returns/{id:int}/qc", async (int id, QCInspectionRequest req, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var staff, "Warehouse");
    if (authRes != null) return authRes;

    await using var qcTransaction = await db.Database.BeginTransactionAsync();
    // TASK-010: kiểm định đúng một lần (Received -> QC_Completed); lặp/đồng thời không trừ Q/P hai lần.
    var qcResult = req.IsPassed ? "Passed" : "Failed";
    var claimed = await db.ReturnRequests.Where(r => r.Id == id && r.Status == "Received")
        .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "QC_Completed").SetProperty(r => r.QCResult, qcResult));
    var ret = await db.ReturnRequests.Include(r => r.Items).FirstOrDefaultAsync(r => r.Id == id);
    if (ret == null) return Results.NotFound();
    if (claimed == 0)
        return Results.Conflict(new { message = $"Yêu cầu đổi trả đang ở trạng thái '{ret.Status}', chỉ kiểm định được sau khi kho tiếp nhận." });

    // If passed: reduce Q (which makes U increase!)
    // If failed: reduce P and Q (goods scrapped)
    foreach (var item in ret.Items)
    {
        if (req.IsPassed)
        {
            item.QCStatus = "Passed";
            await db.InventoryBalances.Where(b => b.Sku == item.Sku)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.Q, b => b.Q - item.Quantity));

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
            await db.InventoryBalances.Where(b => b.Sku == item.Sku)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.P, b => b.P - item.Quantity).SetProperty(b => b.Q, b => b.Q - item.Quantity));

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

    await db.SaveChangesAsync();
    await qcTransaction.CommitAsync();

    return Results.Ok(new { message = "Hoàn tất kiểm định QC.", status = "QC_Completed", qcResult });
});

app.MapPost("/api/admin/returns/{id:int}/refund", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Admin");
    if (authRes != null) return authRes;

    await using var refundTransaction = await db.Database.BeginTransactionAsync();
    // TASK-010: hoàn tiền đúng một lần, sau kiểm định, và chỉ khi đơn đã được đối soát là đã thu tiền.
    // Claim cả hai trạng thái bằng conditional update trước khi đọc.
    var claimed = await db.ReturnRequests.Where(r => r.Id == id && r.Status == "QC_Completed" && r.Order!.PaymentStatus == "Paid")
        .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "Refunded"));
    var ret = await db.ReturnRequests.AsNoTracking().Include(r => r.Order).FirstOrDefaultAsync(r => r.Id == id);
    if (ret == null) return Results.NotFound();
    if (claimed == 0)
    {
        if (ret.Status == "QC_Completed" && ret.Order?.PaymentStatus != "Paid")
            return Results.Conflict(new { message = "Đơn hàng chưa được đối soát là đã thanh toán nên chưa thể hoàn tiền." });
        return Results.Conflict(new { message = $"Yêu cầu đổi trả đang ở trạng thái '{ret.Status}', chỉ hoàn tiền được sau khi hoàn tất kiểm định." });
    }

    await db.Orders.Where(o => o.Id == ret.OrderId)
        .ExecuteUpdateAsync(s => s.SetProperty(o => o.PaymentStatus, "Refunded").SetProperty(o => o.UpdatedAt, DateTime.UtcNow));
    await refundTransaction.CommitAsync();
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

// ==========================================
// MODULE 11: FLASH SALE MANAGEMENT
// ==========================================
app.MapGet("/api/flash-sales/active", async (CatalogDbContext db) =>
{
    var now = DateTime.UtcNow;
    var activeCampaign = await db.FlashSales
        .Include(fs => fs.Items)
            .ThenInclude(fsi => fsi.Product)
        .Include(fs => fs.Items)
            .ThenInclude(fsi => fsi.Variant)
        .Where(fs => fs.IsActive && fs.StartTime <= now && now <= fs.EndTime)
        .OrderBy(fs => fs.EndTime)
        .FirstOrDefaultAsync();

    if (activeCampaign == null)
    {
        return Results.Ok(new { active = false, message = "Hiện không có chiến dịch Flash Sale nào đang diễn ra." });
    }

    var remainingSeconds = Math.Max(0, (int)(activeCampaign.EndTime - now).TotalSeconds);

    var items = activeCampaign.Items
        .Where(i => i.Product != null && i.Product.IsPublished && i.Variant != null && i.Variant.IsActive)
        .Select(i => new
        {
            i.Id,
            i.ProductId,
            productName = i.Product!.Name,
            productSlug = i.Product.Slug,
            imageUrl = i.Variant?.ImageUrl ?? i.Product.ImageUrl,
            packageSize = i.Product.PackageSize,
            saleUnit = i.Product.SaleUnit,
            i.VariantId,
            sku = i.Sku,
            variantName = i.Variant?.Name ?? i.Sku,
            originalPrice = i.OriginalPrice,
            flashSalePrice = i.FlashSalePrice,
            discountPercentage = i.DiscountPercentage,
            quantityLimit = i.QuantityLimit,
            soldCount = i.SoldCount,
            remainingQuota = i.RemainingQuota,
            isSoldOut = i.RemainingQuota <= 0
        })
        .ToList();

    return Results.Ok(new
    {
        active = true,
        campaign = new
        {
            activeCampaign.Id,
            activeCampaign.Name,
            activeCampaign.Description,
            activeCampaign.StartTime,
            activeCampaign.EndTime,
            remainingSeconds,
            items
        }
    });
});

app.MapGet("/api/admin/flash-sales", async (HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Sales");
    if (authRes != null) return authRes;

    var list = await db.FlashSales
        .Include(fs => fs.Items)
            .ThenInclude(i => i.Product)
        .OrderByDescending(fs => fs.CreatedAt)
        .Select(fs => new
        {
            fs.Id,
            fs.Name,
            fs.Description,
            fs.StartTime,
            fs.EndTime,
            fs.IsActive,
            fs.CreatedAt,
            totalItems = fs.Items.Count,
            totalSold = fs.Items.Sum(i => i.SoldCount),
            totalRevenue = fs.Items.Sum(i => i.SoldCount * i.FlashSalePrice),
            items = fs.Items.Select(i => new
            {
                i.Id,
                i.ProductId,
                productName = i.Product != null ? i.Product.Name : "",
                i.VariantId,
                i.Sku,
                i.OriginalPrice,
                i.FlashSalePrice,
                i.QuantityLimit,
                i.SoldCount,
                i.DiscountPercentage
            })
        })
        .ToListAsync();

    return Results.Ok(list);
});

app.MapPost("/api/admin/flash-sales", async (CreateFlashSaleRequest req, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Admin");
    if (authRes != null) return authRes;

    if (string.IsNullOrWhiteSpace(req.Name))
        return Results.BadRequest(new { message = "Tên chiến dịch Flash Sale không được để trống." });
    if (req.EndTime <= req.StartTime)
        return Results.BadRequest(new { message = "Thời gian kết thúc phải sau thời gian bắt đầu." });
    if (req.Items == null || req.Items.Count == 0)
        return Results.BadRequest(new { message = "Chiến dịch phải có ít nhất một sản phẩm tham gia." });

    var flashSale = new FlashSale
    {
        Name = req.Name.Trim(),
        Description = req.Description?.Trim(),
        StartTime = req.StartTime,
        EndTime = req.EndTime,
        IsActive = true
    };
    db.FlashSales.Add(flashSale);
    await db.SaveChangesAsync();

    foreach (var itemReq in req.Items)
    {
        var variant = await db.ProductVariants.Include(v => v.Product).FirstOrDefaultAsync(v => v.Id == itemReq.VariantId);
        if (variant == null) continue;
        if (itemReq.FlashSalePrice <= 0 || itemReq.FlashSalePrice >= variant.Price)
            continue; // check constraint: FlashSalePrice > 0 and FlashSalePrice < OriginalPrice

        db.FlashSaleItems.Add(new FlashSaleItem
        {
            FlashSaleId = flashSale.Id,
            ProductId = variant.ProductId,
            VariantId = variant.Id,
            Sku = variant.Sku,
            OriginalPrice = variant.Price,
            FlashSalePrice = itemReq.FlashSalePrice,
            QuantityLimit = Math.Max(1, itemReq.QuantityLimit),
            SoldCount = 0
        });
    }

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Tạo chiến dịch Flash Sale thành công.", id = flashSale.Id });
});

app.MapPut("/api/admin/flash-sales/{id:int}/toggle", async (int id, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out _, "Admin");
    if (authRes != null) return authRes;

    var fs = await db.FlashSales.FindAsync(id);
    if (fs == null) return Results.NotFound(new { message = "Không tìm thấy chiến dịch Flash Sale." });

    fs.IsActive = !fs.IsActive;
    await db.SaveChangesAsync();

    return Results.Ok(new { message = fs.IsActive ? "Đã kích hoạt Flash Sale." : "Đã tạm dừng Flash Sale.", isActive = fs.IsActive });
});

// ==========================================
// MODULE 12: CHATBOT API (CUSTOMER & ADMIN)
// ==========================================
app.MapPost("/api/chat/customer", async (CustomerChatRequest req, CatalogDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.Message))
        return Results.BadRequest(new { message = "Nội dung tin nhắn không được để trống." });

    var msg = req.Message.Trim();
    var lower = msg.ToLowerInvariant();

    // 1. Order tracking detection (pattern ORD-YYYYMMDD-XXXXX)
    var orderMatch = Regex.Match(msg, @"ORD-\d{8}-\d{5}", RegexOptions.IgnoreCase);
    if (orderMatch.Success)
    {
        var code = orderMatch.Value.ToUpperInvariant();
        var order = await db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.OrderCode == code);

        if (order != null)
        {
            var statusVn = order.Status switch
            {
                "Pending" => "Đang chờ xử lý",
                "Confirmed" => "Đã xác nhận & đang chuẩn bị hàng",
                "Shipped" => "Đang giao hàng",
                "Delivered" => "Đã giao hàng thành công",
                "Cancelled" => "Đã hủy",
                _ => order.Status
            };
            var itemsList = string.Join(", ", order.Items.Select(i => $"{i.ProductName} (x{i.Quantity})"));
            return Results.Ok(new
            {
                reply = $"📦 **Thông tin đơn hàng #{order.OrderCode}**:\n" +
                        $"- **Trạng thái:** {statusVn}\n" +
                        $"- **Người nhận:** {order.CustomerName} ({order.CustomerPhone})\n" +
                        $"- **Địa chỉ giao:** {order.ShippingAddress}\n" +
                        $"- **Tổng tiền thanh toán:** {order.TotalAmount:N0}đ ({order.PaymentMethod} - {order.PaymentStatus})\n" +
                        $"- **Sản phẩm:** {itemsList}\n\n" +
                        "Nếu quý khách cần hỗ trợ thêm về đơn hàng này, vui lòng liên hệ Hotline 1800 6828.",
                suggestions = new[] { "Hướng dẫn đổi trả hàng", "Chính sách bảo hành", "Tra cứu đơn khác" }
            });
        }
        else
        {
            return Results.Ok(new
            {
                reply = $"Không tìm thấy đơn hàng mã `{code}` trong hệ thống V-Pharma. Quý khách vui lòng kiểm tra lại mã đơn hàng hoặc đăng nhập để xem lịch sử mua hàng.",
                suggestions = new[] { "Cách xem lịch sử đơn", "Hotline hỗ trợ 1800 6828" }
            });
        }
    }

    // 2. Health & diagnosis inquiry disclaimer
    var isMedicalQuery = lower.Contains("bệnh") || lower.Contains("đau") || lower.Contains("sốt") ||
                          lower.Contains("viêm") || lower.Contains("uống thuốc gì") || lower.Contains("triệu chứng") ||
                          lower.Contains("kê đơn") || lower.Contains("chẩn đoán") || lower.Contains("chữa");

    // 3. Product search keywords
    var isSearchQuery = lower.Contains("tìm") || lower.Contains("mua") || lower.Contains("giá") ||
                        lower.Contains("thuốc") || lower.Contains("khẩu trang") || lower.Contains("vitamin") ||
                        lower.Contains("paracetamol") || lower.Contains("panadol") || lower.Contains("canxi") ||
                        lower.Contains("dầu gió") || lower.Contains("xịt") || lower.Contains("băng keo") ||
                        lower.Contains("nước súc miệng") || lower.Contains("kem");

    if (isSearchQuery || isMedicalQuery)
    {
        var stopWords = new HashSet<string> { "tìm", "mua", "thuốc", "giá", "cho", "tôi", "có", "bán", "không", "ở", "đâu", "nào", "sản", "phẩm", "loại", "v-pharma", "vui", "lòng", "tư", "vấn" };
        var queryTerms = lower.Split(new[] { ' ', ',', '.', '?' }, StringSplitOptions.RemoveEmptyEntries)
                              .Where(w => w.Length > 1 && !stopWords.Contains(w))
                              .Take(3)
                              .ToList();

        var searchTerm = queryTerms.Count > 0 ? string.Join(" ", queryTerms) : lower;

        var matchingProducts = await db.Products
            .Include(p => p.Variants)
            .Where(p => p.IsPublished && (
                p.Name.Contains(searchTerm) || 
                (p.Description != null && p.Description.Contains(searchTerm)) ||
                (p.Category != null && p.Category.Name.Contains(searchTerm)) ||
                (p.Brand != null && p.Brand.Name.Contains(searchTerm))
            ))
            .OrderByDescending(p => p.IsFeatured)
            .Take(4)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Slug,
                p.ImageUrl,
                p.PackageSize,
                p.SaleUnit,
                price = p.Variants.Where(v => v.IsActive).OrderBy(v => v.Price).Select(v => v.Price).FirstOrDefault(),
                sku = p.Variants.Where(v => v.IsActive).Select(v => v.Sku).FirstOrDefault() ?? ""
            })
            .ToListAsync();

        var medicalDisclaimer = isMedicalQuery 
            ? "\n\n⚠️ *Lưu ý y tế:* V-Pharma cung cấp thông tin tham khảo về sản phẩm. Vui lòng tham khảo ý kiến Bác sĩ hoặc Dược sĩ chuyên môn trước khi sử dụng thuốc hoặc điều trị bệnh."
            : "";

        if (matchingProducts.Count > 0)
        {
            var productListText = string.Join("\n", matchingProducts.Select(p => $"- **{p.Name}** — Giá từ **{p.price:N0}đ** / {p.SaleUnit ?? "sản phẩm"}"));
            return Results.Ok(new
            {
                reply = $"Dưới đây là một số sản phẩm chăm sóc sức khỏe phù hợp tại V-Pharma:\n\n{productListText}{medicalDisclaimer}\n\nBạn có thể nhấn vào sản phẩm bên dưới để xem chi tiết hoặc thêm vào giỏ hàng:",
                products = matchingProducts,
                suggestions = new[] { "Cách đặt hàng online", "Phí vận chuyển", "Chương trình Flash Sale" }
            });
        }
        else if (isMedicalQuery)
        {
            return Results.Ok(new
            {
                reply = $"Dạ V-Pharma đã ghi nhận câu hỏi của bạn. Đối với triệu chứng sức khỏe hoặc các bệnh lý, V-Pharma khuyến nghị quý khách nên tham khảo ý kiến Bác sĩ hoặc liên hệ Dược sĩ trực tuyến qua Hotline **1800 6828** (miễn phí) để được tư vấn chính xác và an toàn nhất.{medicalDisclaimer}",
                suggestions = new[] { "Xem danh mục thuốc", "Xem sản phẩm Flash Sale", "Hotline 1800 6828" }
            });
        }
    }

    // 4. Shipping, Return, Policy FAQs
    if (lower.Contains("giao hàng") || lower.Contains("vận chuyển") || lower.Contains("phí ship") || lower.Contains("mấy ngày"))
    {
        return Results.Ok(new
        {
            reply = "🚚 **Chính sách giao hàng của V-Pharma:**\n" +
                    "- **Miễn phí giao hàng** cho mọi đơn hàng từ **300.000đ** trên toàn quốc.\n" +
                    "- **Giao hỏa tốc 2 giờ:** Áp dụng tại khu vực nội thành TP.HCM và Hà Nội.\n" +
                    "- **Giao tiêu chuẩn:** 1-2 ngày đối với khu vực thành phố, 2-3 ngày với các tỉnh thành khác.\n" +
                    "- Được đồng kiểm và kiểm tra bao bì sản phẩm trước khi nhận.",
            suggestions = new[] { "Chính sách đổi trả", "Phương thức thanh toán", "Sản phẩm khuyến mãi" }
        });
    }

    if (lower.Contains("đổi trả") || lower.Contains("hoàn tiền") || lower.Contains("bảo hành") || lower.Contains("hỏng"))
    {
        return Results.Ok(new
        {
            reply = "🔄 **Chính sách đổi trả & hoàn tiền V-Pharma:**\n" +
                    "- Hỗ trợ đổi trả trong vòng **30 ngày** kể từ ngày nhận hàng.\n" +
                    "- Áp dụng đối với sản phẩm còn nguyên tem mác, chưa qua sử dụng hoặc có lỗi từ nhà sản xuất / hư hỏng do vận chuyển.\n" +
                    "- Hoàn tiền 100% qua tài khoản ngân hàng hoặc đổi sản phẩm mới miễn phí vận chuyển 2 chiều.",
            suggestions = new[] { "Liên hệ Hotline hỗ trợ", "Cách đặt hàng", "Kiểm tra đơn hàng" }
        });
    }

    if (lower.Contains("thanh toán") || lower.Contains("cod") || lower.Contains("chuyển khoản") || lower.Contains("thẻ"))
    {
        return Results.Ok(new
        {
            reply = "💳 **Phương thức thanh toán tại V-Pharma:**\n" +
                    "- **COD:** Thanh toán tiền mặt khi nhận hàng tận nơi.\n" +
                    "- **Chuyển khoản ngân hàng / VNPay / Ví điện tử:** Nhanh chóng và bảo mật.\n" +
                    "- Đảm bảo an toàn tuyệt đối 100% cho mọi giao dịch.",
            suggestions = new[] { "Chính sách giao hàng", "Khuyến mãi hiện có" }
        });
    }

    if (lower.Contains("flash sale") || lower.Contains("khuyến mãi") || lower.Contains("giảm giá") || lower.Contains("ưu đãi"))
    {
        return Results.Ok(new
        {
            reply = "🔥 V-Pharma đang diễn ra chương trình **Flash Sale Giờ Vàng Dược Phẩm** giảm giá đến 40% cho nhiều mặt hàng vitamin, thực phẩm chức năng và vật tư y tế! Ngoài ra, quý khách có thể nhập mã voucher giảm thêm khi thanh toán tại trang Checkout.",
            suggestions = new[] { "Xem Flash Sale", "Xem mã giảm giá", "Sản phẩm bán chạy" }
        });
    }

    // Default friendly greeting & routing
    return Results.Ok(new
    {
        reply = "Xin chào! Em là Trợ lý ảo V-Pharma 🌿. Em có thể hỗ trợ bạn:\n" +
                "- 🔍 Tìm kiếm thuốc, vitamin, thực phẩm chức năng chính hãng\n" +
                "- 📦 Tra cứu trạng thái đơn hàng (nhập mã đơn như `ORD-...`)\n" +
                "- 🚚 Tư vấn chính sách giao nhận 2h, đổi trả trong 30 ngày\n" +
                "- 🎁 Thông tin Flash Sale và mã giảm giá hôm nay\n\n" +
                "Bạn cần hỗ trợ thông tin gì ạ?",
        suggestions = new[] { "Tìm vitamin C", "Flash Sale hôm nay", "Chính sách đổi trả", "Hotline 1800 6828" }
    });
});

app.MapPost("/api/chat/admin", async (AdminChatRequest req, HttpContext context, CatalogDbContext db) =>
{
    var authRes = RequireAuth(context, out var user, "CustomerSupport");
    if (authRes != null) return authRes;

    if (string.IsNullOrWhiteSpace(req.Message))
        return Results.BadRequest(new { message = "Nội dung tin nhắn không được để trống." });

    var lower = req.Message.Trim().ToLowerInvariant();

    if (lower.Contains("tồn kho") || lower.Contains("kho") || lower.Contains("inventory") || lower.Contains("stock"))
    {
        var balances = await db.InventoryBalances.ToListAsync();
        var totalP = balances.Sum(b => b.P);
        var totalQ = balances.Sum(b => b.Q);
        var totalB = balances.Sum(b => b.B);
        var totalR = balances.Sum(b => b.R);
        var totalA = balances.Sum(b => b.A);
        var totalU = balances.Sum(b => b.AvailableStock);
        var lowStockCount = balances.Count(b => b.AvailableStock <= b.B);

        return Results.Ok(new
        {
            reply = $"📊 **Báo cáo Tồn kho Hệ thống V-Pharma (Kho WH-CENTRAL):**\n" +
                    $"- **Tổng tồn vật lý (P):** {totalP:N0} đơn vị\n" +
                    $"- **Tồn cách ly / QC (Q):** {totalQ:N0} đơn vị\n" +
                    $"- **Tồn an toàn (B):** {totalB:N0} đơn vị\n" +
                    $"- **Đang giữ chỗ cho đơn (R):** {totalR:N0} đơn vị\n" +
                    $"- **Cam kết sàn ngoài (A):** {totalA:N0} đơn vị\n" +
                    $"- **Khả dụng bán (U = P - Q - B - R - A):** **{totalU:N0}** đơn vị\n" +
                    $"- **Cảnh báo sắp hết hàng (U <= B):** {lowStockCount} SKU\n\n" +
                    $"*Invariant check:* U >= 0 và các thành phần không âm được đảm bảo 100%.",
            data = new { totalP, totalQ, totalB, totalR, totalA, totalU, lowStockCount }
        });
    }

    if (lower.Contains("đơn hàng") || lower.Contains("doanh thu") || lower.Contains("order") || lower.Contains("kpi"))
    {
        var totalOrders = await db.Orders.CountAsync();
        var pendingOrders = await db.Orders.CountAsync(o => o.Status == "Pending" || o.Status == "Confirmed");
        var deliveredOrders = await db.Orders.CountAsync(o => o.Status == "Delivered");
        var cancelledOrders = await db.Orders.CountAsync(o => o.Status == "Cancelled");
        var totalRevenue = await db.Orders.Where(o => o.Status != "Cancelled").SumAsync(o => (decimal?)o.TotalAmount) ?? 0;

        return Results.Ok(new
        {
            reply = $"📈 **Tóm tắt Hiệu suất Kinh doanh V-Pharma:**\n" +
                    $"- **Tổng số đơn hàng:** {totalOrders}\n" +
                    $"- **Đơn chờ xử lý / chuẩn bị:** {pendingOrders}\n" +
                    $"- **Đơn đã giao thành công:** {deliveredOrders}\n" +
                    $"- **Đơn đã hủy:** {cancelledOrders}\n" +
                    $"- **Tổng doanh thu thực tế:** **{totalRevenue:N0}đ**\n",
            data = new { totalOrders, pendingOrders, deliveredOrders, cancelledOrders, totalRevenue }
        });
    }

    if (lower.Contains("flash sale") || lower.Contains("khuyến mãi"))
    {
        var now = DateTime.UtcNow;
        var activeFs = await db.FlashSales.Include(fs => fs.Items).FirstOrDefaultAsync(fs => fs.IsActive && fs.StartTime <= now && now <= fs.EndTime);
        if (activeFs != null)
        {
            var totalSold = activeFs.Items.Sum(i => i.SoldCount);
            var totalLimit = activeFs.Items.Sum(i => i.QuantityLimit);
            return Results.Ok(new
            {
                reply = $"⚡ **Chiến dịch Flash Sale đang chạy:** '{activeFs.Name}'\n" +
                        $"- Thời gian: {activeFs.StartTime:dd/MM HH:mm} - {activeFs.EndTime:dd/MM HH:mm} UTC\n" +
                        $"- Số sản phẩm tham gia: {activeFs.Items.Count}\n" +
                        $"- Tỷ lệ bán: {totalSold}/{totalLimit} suất ({Math.Round((double)totalSold * 100 / Math.Max(1, totalLimit), 1)}%)",
                data = new { activeFs.Name, totalSold, totalLimit }
            });
        }
        else
        {
            return Results.Ok(new { reply = "Hiện tại không có chiến dịch Flash Sale nào đang kích hoạt." });
        }
    }

    return Results.Ok(new
    {
        reply = $"Xin chào {user.FullName} ({user.Role})! Tôi là V-Pharma Admin Copilot.\n" +
                $"Bạn có thể hỏi tôi về:\n" +
                $"- 'Báo cáo tồn kho': Kiểm tra số liệu P, Q, B, R, A, U và cảnh báo thiếu hàng\n" +
                $"- 'Báo cáo đơn hàng' hoặc 'Doanh thu': Xem tổng quan KPI bán hàng\n" +
                $"- 'Flash sale': Xem tình hình chiến dịch khuyến mãi đang chạy\n" +
                $"- Hỗ trợ tra cứu các thao tác trong Admin Live Panel."
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

public sealed record CreateFlashSaleItemRequest(int VariantId, decimal FlashSalePrice, int QuantityLimit);
public sealed record CreateFlashSaleRequest(string Name, string? Description, DateTime StartTime, DateTime EndTime, List<CreateFlashSaleItemRequest> Items);
public sealed record CustomerChatRequest(string Message, string? SessionId = null);
public sealed record AdminChatRequest(string Message);
