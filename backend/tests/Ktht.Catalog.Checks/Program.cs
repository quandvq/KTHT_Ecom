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

Console.WriteLine($"\n[TẤT CẢ {cases.Length + 6} BÀI KIỂM TRA NGHIỆP VỤ ĐÃ VƯỢT QUA THÀNH CÔNG!]");
