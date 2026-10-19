using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DispatchTrack.Api.DTOs.Auth;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DispatchTrack.API.Tests;

public class AuthIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public AuthIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = true // Preserves Set-Cookie across requests like a real browser
        });
    }

    [Fact]
    public async Task HealthEndpoint_ShouldReturn200AndHealthyStatus()
    {
        // Act
        var response = await _client.GetAsync("/health");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Healthy", content);
    }

    [Fact]
    public async Task GetCurrentUser_WithoutToken_ShouldReturn401Unauthorized()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/auth/me");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_ShouldReturn401Unauthorized()
    {
        // Arrange
        var request = new LoginRequestDto
        {
            Email = "nonexistent@dispatchtrack.local",
            Password = "WrongPassword999!"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/auth/login", request);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithValidCredentials_ShouldReturnTokensAndAllowAccessToProtectedEndpoints()
    {
        // Arrange - use seeded admin account
        var loginRequest = new LoginRequestDto
        {
            Email = "admin@dispatchtrack.local",
            Password = "Password123!"
        };

        // Act: 1. Login
        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", loginRequest);

        // Assert: Login success
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var authResult = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        Assert.NotNull(authResult);
        Assert.NotEmpty(authResult.AccessToken);
        Assert.Equal("admin@dispatchtrack.local", authResult.User.Email);
        Assert.Equal("Admin", authResult.User.Role);

        // Assert: Refresh token cookie is set
        var cookies = loginResponse.Headers.GetValues("Set-Cookie");
        Assert.Contains(cookies, c => c.Contains("refreshToken="));

        // Act: 2. Access protected endpoint using Bearer token
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", authResult.AccessToken);
        var meResponse = await _client.GetAsync("/api/auth/me");

        // Assert: Protected endpoint accessible
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var profile = await meResponse.Content.ReadFromJsonAsync<UserProfileDto>();
        Assert.NotNull(profile);
        Assert.Equal("admin@dispatchtrack.local", profile.Email);

        // Act: 3. Rotate refresh token via /api/auth/refresh (cookies handled by HttpClient)
        var refreshResponse = await _client.PostAsync("/api/auth/refresh", null);

        // Assert: Rotation success
        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);
        var refreshedAuth = await refreshResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        Assert.NotNull(refreshedAuth);
        Assert.NotEmpty(refreshedAuth.AccessToken);

        // Act: 4. Logout
        var logoutResponse = await _client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.OK, logoutResponse.StatusCode);
    }
}
