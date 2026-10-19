using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using DispatchTrack.Api.Models;
using DispatchTrack.Api.Services;
using Microsoft.Extensions.Configuration;

namespace DispatchTrack.API.Tests;

public class TokenServiceTests
{
    private readonly IConfiguration _config;
    private readonly TokenService _tokenService;

    public TokenServiceTests()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            {"Jwt:Secret", "this-is-a-test-secret-key-that-is-at-least-256-bits-long-1234567890"},
            {"Jwt:Issuer", "DispatchTrackTest"},
            {"Jwt:Audience", "DispatchTrackTest"}
        };

        _config = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        _tokenService = new TokenService(_config);
    }

    [Fact]
    public void GenerateAccessToken_ShouldIncludeExpectedClaims()
    {
        // Arrange
        var user = new User
        {
            Id = 42,
            Email = "dispatcher@dispatchtrack.local",
            FullName = "Dispatcher Jane",
            Role = UserRole.Dispatcher
        };

        // Act
        var tokenString = _tokenService.GenerateAccessToken(user);

        // Assert
        Assert.NotNull(tokenString);
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(tokenString);

        Assert.Equal("DispatchTrackTest", token.Issuer);
        Assert.Contains(token.Audiences, a => a == "DispatchTrackTest");

        var subClaim = token.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub)?.Value;
        Assert.Equal("42", subClaim);

        var roleClaim = token.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value;
        Assert.Equal("Dispatcher", roleClaim);

        var emailClaim = token.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Email)?.Value;
        Assert.Equal("dispatcher@dispatchtrack.local", emailClaim);
    }

    [Fact]
    public void GenerateRefreshToken_ShouldProduceCryptographicallyRandomTokens()
    {
        // Act
        var (rawToken1, hash1) = _tokenService.GenerateRefreshToken();
        var (rawToken2, hash2) = _tokenService.GenerateRefreshToken();

        // Assert
        Assert.NotEmpty(rawToken1);
        Assert.NotEmpty(hash1);
        Assert.NotEqual(rawToken1, rawToken2);
        Assert.NotEqual(hash1, hash2);
    }

    [Fact]
    public void HashToken_ShouldBeDeterministic()
    {
        // Arrange
        var (rawToken, expectedHash) = _tokenService.GenerateRefreshToken();

        // Act
        var calculatedHash = _tokenService.HashToken(rawToken);

        // Assert
        Assert.Equal(expectedHash, calculatedHash);
    }
}
