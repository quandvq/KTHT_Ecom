using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Ktht.Domain;

namespace Ktht.Infrastructure;

public sealed record AuthUserClaims(int Id, string Email, string FullName, string Role);

public static class JwtTokenService
{
    // 256-bit signing key for local development and demo
    private static readonly byte[] SecretKey = Encoding.UTF8.GetBytes("KTHT_Ecom_Secure_Jwt_Key_2026_Development_Secret_32B!");

    public static string GenerateToken(User user, TimeSpan? expiry = null)
    {
        var header = new { alg = "HS256", typ = "JWT" };
        var now = DateTimeOffset.UtcNow;
        var exp = now.Add(expiry ?? TimeSpan.FromDays(7)).ToUnixTimeSeconds();

        var payload = new Dictionary<string, object>
        {
            ["sub"] = user.Id.ToString(),
            ["email"] = user.Email,
            ["name"] = user.FullName,
            ["role"] = user.Role,
            ["iat"] = now.ToUnixTimeSeconds(),
            ["exp"] = exp
        };

        var headerBase64 = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(header));
        var payloadBase64 = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload));

        var dataToSign = Encoding.UTF8.GetBytes($"{headerBase64}.{payloadBase64}");
        using var hmac = new HMACSHA256(SecretKey);
        var signature = Base64UrlEncode(hmac.ComputeHash(dataToSign));

        return $"{headerBase64}.{payloadBase64}.{signature}";
    }

    public static AuthUserClaims? ValidateToken(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        if (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            token = token["Bearer ".Length..].Trim();

        var parts = token.Split('.');
        if (parts.Length != 3) return null;

        var headerBase64 = parts[0];
        var payloadBase64 = parts[1];
        var signatureBase64 = parts[2];

        // Verify signature
        var dataToSign = Encoding.UTF8.GetBytes($"{headerBase64}.{payloadBase64}");
        using var hmac = new HMACSHA256(SecretKey);
        var expectedSig = Base64UrlEncode(hmac.ComputeHash(dataToSign));

        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedSig),
            Encoding.UTF8.GetBytes(signatureBase64)))
        {
            return null;
        }

        try
        {
            var payloadBytes = Base64UrlDecode(payloadBase64);
            using var doc = JsonDocument.Parse(payloadBytes);
            var root = doc.RootElement;

            if (root.TryGetProperty("exp", out var expProp))
            {
                var exp = expProp.GetInt64();
                if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp)
                    return null; // Expired
            }

            var id = int.Parse(root.GetProperty("sub").GetString()!);
            var email = root.GetProperty("email").GetString()!;
            var name = root.GetProperty("name").GetString()!;
            var role = root.GetProperty("role").GetString()!;

            return new AuthUserClaims(id, email, name, role);
        }
        catch
        {
            return null;
        }
    }

    private static string Base64UrlEncode(byte[] input) =>
        Convert.ToBase64String(input).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string input)
    {
        var output = input.Replace('-', '+').Replace('_', '/');
        switch (output.Length % 4)
        {
            case 2: output += "=="; break;
            case 3: output += "="; break;
        }
        return Convert.FromBase64String(output);
    }
}

