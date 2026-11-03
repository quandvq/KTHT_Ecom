using Ktht.Application;
using Ktht.Infrastructure;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Configure ConnectionStrings:DefaultConnection before starting the API.");
builder.Services.AddDbContext<CatalogDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddScoped<IProductReader, ProductReader>();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173").AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddProblemDetails();
var app = builder.Build();
app.UseExceptionHandler();
app.UseCors();
if (args.Contains("--seed-demo"))
{
    if (!app.Environment.IsDevelopment())
        throw new InvalidOperationException("Demo seed requires ASPNETCORE_ENVIRONMENT=Development.");
    using var scope = app.Services.CreateScope();
    await CatalogDemoSeed.RunAsync(scope.ServiceProvider.GetRequiredService<CatalogDbContext>());
    return;
}
app.MapGet("/api/categories", async (IProductReader reader, CancellationToken cancellationToken) =>
    Results.Ok(await reader.GetCategoriesAsync(cancellationToken)));
app.MapGet("/api/products", async (string? q, string? category, string? sort, int? page, int? pageSize, bool? featured,
    decimal? minPrice, decimal? maxPrice, IProductReader reader, CancellationToken cancellationToken) =>
{
    var query = new CatalogQuery(q, category, sort ?? "featured", page ?? 1, pageSize ?? 12, featured, minPrice, maxPrice);
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
app.Run();
