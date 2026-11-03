namespace Ktht.Domain;

public sealed class Brand
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
}

