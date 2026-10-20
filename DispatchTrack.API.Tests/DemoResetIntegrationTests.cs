using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using DispatchTrack.Api.Data;
using DispatchTrack.Api.DTOs.Auth;
using DispatchTrack.Api.DTOs.Jobs;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DispatchTrack.API.Tests;

public class DemoResetIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public DemoResetIntegrationTests(WebApplicationFactory<Program> factory)
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
    public async Task Reset_AsNonAdmin_Returns403()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var response = await dispatcher.PostAsync("/api/demo/reset", null);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Reset_AsAdmin_RemovesJunkAndRestoresSeededState()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var admin = await LoginAsAsync("admin@dispatchtrack.local");

        // Arrange: create identifiable junk that reset must remove
        var junkResponse = await dispatcher.PostAsJsonAsync("/api/jobs", new CreateJobRequestDto
        {
            PickupAddress = "RESET-JUNK Pickup",
            PickupLat = -33.9,
            PickupLng = 18.4,
            DropoffAddress = "RESET-JUNK Dropoff",
            DropoffLat = -33.91,
            DropoffLng = 18.41,
            Notes = $"RESET-JUNK {Guid.NewGuid()}"
        });
        junkResponse.EnsureSuccessStatusCode();
        var junk = await junkResponse.Content.ReadFromJsonAsync<JobResponseDto>();

        // Act
        var reset = await admin.PostAsync("/api/demo/reset", null);

        // Assert: reset succeeded and junk is gone
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        var junkGone = await dispatcher.GetAsync($"/api/jobs/{junk!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, junkGone.StatusCode);

        // Seeded sample jobs are back
        var jobs = await dispatcher.GetFromJsonAsync<PagedJobsDto>("/api/jobs?page=1&pageSize=100");
        Assert.NotNull(jobs);
        Assert.Contains(jobs!.Items, j => j.PickupAddress == "10 Industrial Ring, Zone 1");
        Assert.Contains(jobs.Items, j => j.PickupAddress == "12 Central Square, CBD");

        // Seeded credentials still work after the reset (accounts were recreated)
        var loginClient = _factory.CreateClient();
        var login = await loginClient.PostAsJsonAsync("/api/auth/login", new LoginRequestDto
        {
            Email = "admin@dispatchtrack.local",
            Password = DataSeeder.DefaultPassword
        });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }
}
