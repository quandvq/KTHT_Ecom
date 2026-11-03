namespace Ktht.Domain;

public class CustomerAddress
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string StreetAddress { get; set; } = string.Empty;
    public string? Ward { get; set; }
    public string? District { get; set; }
    public string City { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
}

