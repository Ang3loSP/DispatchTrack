using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using DispatchTrack.Api.Data;
using DispatchTrack.Api.DTOs.Auth;
using DispatchTrack.Api.DTOs.Drivers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DispatchTrack.API.Tests;

public class UsersDriversIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public UsersDriversIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private async Task<HttpClient> LoginAsAsync(string email)
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto
        {
            Email = email,
            Password = DataSeeder.DefaultPassword
        });
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        return client;
    }

    [Fact]
    public async Task CreateUser_AsDispatcher_Returns403()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");

        var response = await dispatcher.PostAsJsonAsync("/api/users", new
        {
            email = $"itest-{Guid.NewGuid():N}@dispatchtrack.local",
            password = DataSeeder.DefaultPassword,
            fullName = "ITEST User",
            role = "Dispatcher"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateUser_AsAdmin_CreatesDispatcherThatCanLogIn()
    {
        var admin = await LoginAsAsync("admin@dispatchtrack.local");
        var email = $"itest-{Guid.NewGuid():N}@dispatchtrack.local";

        var response = await admin.PostAsJsonAsync("/api/users", new
        {
            email,
            password = DataSeeder.DefaultPassword,
            fullName = "ITEST Dispatcher",
            role = "Dispatcher"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        // The new account can immediately authenticate
        var loginClient = _factory.CreateClient();
        var login = await loginClient.PostAsJsonAsync("/api/auth/login", new LoginRequestDto
        {
            Email = email,
            Password = DataSeeder.DefaultPassword
        });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task CreateUser_DuplicateEmail_Returns409()
    {
        var admin = await LoginAsAsync("admin@dispatchtrack.local");

        var response = await admin.PostAsJsonAsync("/api/users", new
        {
            email = "admin@dispatchtrack.local", // already seeded
            password = DataSeeder.DefaultPassword,
            fullName = "Duplicate Admin",
            role = "Dispatcher"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task CreateUser_WithAdminRole_Returns400()
    {
        var admin = await LoginAsAsync("admin@dispatchtrack.local");

        var response = await admin.PostAsJsonAsync("/api/users", new
        {
            email = $"itest-{Guid.NewGuid():N}@dispatchtrack.local",
            password = DataSeeder.DefaultPassword,
            fullName = "ITEST Admin",
            role = "Admin"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetDrivers_AsDispatcher_ReturnsSeededDriverWithStatus()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");

        var drivers = await dispatcher.GetFromJsonAsync<List<DriverResponseDto>>("/api/drivers");

        Assert.NotNull(drivers);
        var seeded = drivers!.Single(d => d.Email == "driver@dispatchtrack.local");
        Assert.Equal("DT-VAN-01", seeded.VehicleReg);
        Assert.Contains(seeded.CurrentStatus, new[] { "Available", "OnRoute", "Offline" });
    }
}
