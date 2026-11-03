using Ktht.Application;
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
    ("long category", new(Category: new string('a', 101)), "category")
};
foreach (var (name, query, expectedError) in cases)
{
    var errors = query.Validate();
    if (expectedError is null ? errors.Count != 0 : !errors.ContainsKey(expectedError))
        throw new Exception($"FAIL: {name}");
    Console.WriteLine($"PASS: {name}");
}
Console.WriteLine($"{cases.Length} catalog validation checks passed. SQL behavior is verified separately.");
