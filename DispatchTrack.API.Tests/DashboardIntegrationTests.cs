using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using DispatchTrack.Api.Data;
using DispatchTrack.Api.DTOs.Auth;
using DispatchTrack.Api.DTOs.Dashboard;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DispatchTrack.API.Tests;

public class DashboardIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public DashboardIntegrationTests(WebApplicationFactory<Program> factory)
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
    public async Task GetSummary_WithoutToken_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/dashboard/summary");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetSummary_AsDriver_Returns403()
    {
        var driver = await LoginAsAsync("driver@dispatchtrack.local");
        var response = await driver.GetAsync("/api/dashboard/summary");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetSummary_AsAdmin_ReturnsStableShapeWithAllStatusKeys()
    {
        var admin = await LoginAsAsync("admin@dispatchtrack.local");

        var summary = await admin.GetFromJsonAsync<DashboardSummaryDto>("/api/dashboard/summary");

        Assert.NotNull(summary);
        // Seeded data: at least 2 jobs, 1 driver
        Assert.True(summary!.TotalJobs >= 2);
        Assert.True(summary.TotalDrivers >= 1);

        // Stable shape: every status key is present (0-filled), counts sum to totals
        foreach (var status in new[] { "Pending", "Assigned", "InTransit", "Delivered", "Failed" })
        {
            Assert.Contains(status, summary.JobsByStatus.Keys);
        }
        Assert.Equal(summary.TotalJobs, summary.JobsByStatus.Values.Sum());

        foreach (var status in new[] { "Available", "OnRoute", "Offline" })
        {
            Assert.Contains(status, summary.DriversByStatus.Keys);
        }
        Assert.Equal(summary.TotalDrivers, summary.DriversByStatus.Values.Sum());
        Assert.True(summary.JobsCreatedToday >= 0);
    }

    [Fact]
    public async Task GetSummary_SecondCall_IsConsistentWithCachedPath()
    {
        var admin = await LoginAsAsync("admin@dispatchtrack.local");

        var first = await admin.GetFromJsonAsync<DashboardSummaryDto>("/api/dashboard/summary");
        var second = await admin.GetFromJsonAsync<DashboardSummaryDto>("/api/dashboard/summary");

        Assert.NotNull(first);
        Assert.NotNull(second);
        // First call may be served from DB, second hits the 60s cache. Parallel test classes
        // may create jobs in between, so totals can only grow, never shrink.
        Assert.True(second!.TotalJobs >= first!.TotalJobs);
        Assert.Equal(second.TotalJobs, second.JobsByStatus.Values.Sum());
    }
}
