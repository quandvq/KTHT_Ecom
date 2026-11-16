using Ktht.Application;
using Ktht.Domain;
using Ktht.Infrastructure;

Console.WriteLine("=== CHẠY BỘ KIỂM THỬ NGHIỆP VỤ HỆ THỐNG KTHT ===");

// 1. Catalog Validation Checks
var cases = new (string Name, CatalogQuery Query, string? ExpectedError)[]
{
    ("defaults", new(), null),
    ("zero page", new(Page: 0), "pagination"),
    ("negative extreme page", new(Page: int.MinValue), "pagination"),
    ("oversized page", new(Page: int.MaxValue, PageSize: 100), "pagination"),
    ("zero page size", new(PageSize: 0), "pagination"),
    ("oversized page size", new(PageSize: 101), "pagination"),
    ("max page size", new(PageSize: 100), null),
    ("unknown sort", new(Sort: "random"), "sort"),
    ("price ascending", new(Sort: "price-asc"), null),
    ("name ordering", new(Sort: "name"), null),
    ("negative price", new(MinPrice: -1), "price"),
    ("inverted price range", new(MinPrice: 200, MaxPrice: 100), "price"),
    ("equal range", new(MinPrice: 100, MaxPrice: 100), null),
    ("price overflow", new(MaxPrice: decimal.MaxValue), "price"),
    ("long search", new(Q: new string('a', 201)), "q"),
    ("long category", new(Category: new string('a', 101)), "category"),
    ("long brand", new(Brand: new string('b', 101)), "brand")
};

foreach (var (name, query, expectedError) in cases)
{
    var errors = query.Validate();
    if (expectedError is null ? errors.Count != 0 : !errors.ContainsKey(expectedError))
        throw new Exception($"FAIL: {name}");
    Console.WriteLine($"PASS: Catalog - {name}");
}

// 2. Password Security Checks (PBKDF2)
var (hash, salt) = PasswordSecurity.HashPassword("Ktht@2026");
if (!PasswordSecurity.VerifyPassword("Ktht@2026", hash, salt))
    throw new Exception("FAIL: Password verification succeeded with wrong result");
if (PasswordSecurity.VerifyPassword("WrongPassword", hash, salt))
    throw new Exception("FAIL: Password verification accepted wrong password");
Console.WriteLine("PASS: Security - PBKDF2 Password Hashing & Verification");

// 3. JWT Token Security Checks
var testUser = new User { Id = 101, Email = "test@ktht.local", FullName = "Tester", Role = "Sales" };
var token = JwtTokenService.GenerateToken(testUser, TimeSpan.FromMinutes(30));
var claims = JwtTokenService.ValidateToken(token);
if (claims == null || claims.Id != 101 || claims.Email != "test@ktht.local" || claims.Role != "Sales")
    throw new Exception("FAIL: JWT Claims verification failed");

var expiredToken = JwtTokenService.GenerateToken(testUser, TimeSpan.FromSeconds(-5));
if (JwtTokenService.ValidateToken(expiredToken) != null)
    throw new Exception("FAIL: JWT accepted expired token");
Console.WriteLine("PASS: Security - JWT Token Generation, Verification & Expiry");

// 4. Inventory Invariant Checks: U = P - Q - B - R - A
var balance = new InventoryBalance
{
    Sku = "PMC-TEST-01",
    WarehouseCode = "WH-CENTRAL",
    P = 100, // Physical
    Q = 5,   // Quarantined
    B = 10,  // Safety stock
    R = 15,  // Reserved
    A = 20   // Channel quota
};
// U = 100 - 5 - 10 - 15 - 20 = 50
if (balance.AvailableStock != 50)
    throw new Exception($"FAIL: Inventory AvailableStock expected 50, got {balance.AvailableStock}");
Console.WriteLine("PASS: Inventory - Invariant U = P - Q - B - R - A calculation");

// 5. Atomic Reservation Movement Check
// Nhận thêm đơn 20: R tăng từ 15 lên 35 -> U giảm từ 50 xuống 30
balance.R += 20;
if (balance.AvailableStock != 30)
    throw new Exception($"FAIL: Inventory post-reservation U expected 30, got {balance.AvailableStock}");
Console.WriteLine("PASS: Inventory - Reservation increases R and reduces U");

// 6. Fulfillment Movement Check: Xuất kho 20 cái
// Xuất kho giảm P và giảm R cùng 20 -> U không đổi (vẫn 30)
balance.P -= 20;
balance.R -= 20;
if (balance.AvailableStock != 30)
    throw new Exception($"FAIL: Inventory post-fulfillment U expected 30, got {balance.AvailableStock}");
Console.WriteLine("PASS: Inventory - Fulfillment decreases P and R, leaves U invariant");

// 7. QC Inspection Pass Check: Giải phóng hàng cách ly Q -> tăng U
// Q giảm 5 -> U tăng từ 30 lên 35
balance.Q -= 5;
if (balance.AvailableStock != 35)
    throw new Exception($"FAIL: Inventory post-QC Pass U expected 35, got {balance.AvailableStock}");
Console.WriteLine("PASS: Inventory - QC Pass reduces Q and increases available U");

// 8. Storefront availability derived from U (TASK-010): khách chỉ thấy mức, không thấy số U.
var availabilityCases = new (int? Units, string? Expected)[]
{
    (null, null),
    (-3, StockAvailability.OutOfStock),
    (0, StockAvailability.OutOfStock),
    (1, StockAvailability.LowStock),
    (StockAvailability.LowStockThreshold, StockAvailability.LowStock),
    (StockAvailability.LowStockThreshold + 1, StockAvailability.InStock)
};
foreach (var (units, expected) in availabilityCases)
{
    var actual = StockAvailability.FromUnits(units);
    if (actual != expected) throw new Exception($"FAIL: Availability for U={units?.ToString() ?? "null"} expected {expected ?? "null"}, got {actual ?? "null"}");
}
// Ví dụ AGENTS mục 7: P=10, R=2, A=3 -> U=5 -> sắp hết; nhận thêm đơn 1 -> U=4 vẫn sắp hết; R tăng tới hết U -> hết hàng.
var sample = new InventoryBalance { P = 10, R = 2, A = 3 };
if (StockAvailability.FromUnits(sample.P - sample.Q - sample.B - sample.R - sample.A) != StockAvailability.LowStock)
    throw new Exception("FAIL: Availability for AGENTS sample U=5 should be LowStock");
sample.R += 5;
if (StockAvailability.FromUnits(sample.P - sample.Q - sample.B - sample.R - sample.A) != StockAvailability.OutOfStock)
    throw new Exception("FAIL: Availability after reserving all U should be OutOfStock");
Console.WriteLine("PASS: Inventory - Storefront availability levels derived from U");

// 9. Return policy (TASK-010 R-001): MVP chỉ trả toàn bộ đơn; tổng trả không vượt lượng đã giao.
var deliveredLines = new List<ReturnLine> { new(5, 1), new(6, 3) };
var returnCases = new (string Name, List<ReturnLine> Requested, bool Accepted)[]
{
    ("full order", [new(5, 1), new(6, 3)], true),
    ("full order, other line order", [new(6, 3), new(5, 1)], true),
    ("duplicate line exceeds delivered", [new(5, 1), new(5, 1), new(6, 3)], false),
    ("partial quantity", [new(5, 1), new(6, 2)], false),
    ("missing line", [new(5, 1)], false),
    ("over quantity", [new(5, 2), new(6, 3)], false),
    ("foreign line", [new(5, 1), new(6, 3), new(99, 1)], false),
    ("zero quantity", [new(5, 0), new(6, 3)], false),
    ("empty", [], false)
};
foreach (var (name, requested, accepted) in returnCases)
{
    var error = ReturnPolicy.ValidateFullOrder(deliveredLines, requested);
    if ((error is null) != accepted) throw new Exception($"FAIL: Return policy - {name}: {error ?? "accepted"}");
}
Console.WriteLine($"PASS: Returns - Full-order policy ({returnCases.Length} cases: duplicate, partial, missing, foreign lines rejected)");

Console.WriteLine($"\n[TẤT CẢ {cases.Length + 8} BÀI KIỂM TRA NGHIỆP VỤ ĐÃ VƯỢT QUA THÀNH CÔNG!]");
