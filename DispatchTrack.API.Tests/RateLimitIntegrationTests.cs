using System.Net;
using System.Net.Http.Json;
using DispatchTrack.Api.DTOs.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DispatchTrack.API.Tests;

/// <summary>
/// The "auth" rate limit policy is only enforced outside Development (plan §5), so these tests
/// boot a second host with the Production environment to prove the limiter actually kicks in.
/// </summary>
public class RateLimitIntegrationTests
{
    private const string TestJwtSecret = "rate-limit-integration-test-secret-0123456789";

    private static string ApiContentRoot()
    {
        // Same discovery mechanism WebApplicationFactory uses: the manifest maps the API
        // assembly to its project directory, which is where appsettings files live.
        var manifestPath = Path.Combine(AppContext.BaseDirectory, "MvcTestingAppManifest.json");
        var manifest = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(
            File.ReadAllText(manifestPath));
        return manifest![typeof(Program).Assembly.FullName!];
    }

    [Fact]
    public async Task Login_BeyondPermitLimit_Returns429InProduction()
    {
        // Production skips appsettings.Development.json (Neon connection string) and user-secrets
        // (JWT secret), so both are supplied as environment variables — they take precedence over
        // appsettings.json in the configuration chain.
        var developmentSettings = System.Text.Json.JsonDocument.Parse(
            File.ReadAllText(Path.Combine(ApiContentRoot(), "appsettings.Development.json")));
        var connectionString = developmentSettings.RootElement
            .GetProperty("ConnectionStrings").GetProperty("Default").GetString();

        Environment.SetEnvironmentVariable("ConnectionStrings__Default", connectionString);
        Environment.SetEnvironmentVariable("Jwt__Secret", TestJwtSecret);

        try
        {
            await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
                builder.UseEnvironment("Production"));
            var client = factory.CreateClient();

            var sawTooManyRequests = false;
            for (var attempt = 0; attempt < 12 && !sawTooManyRequests; attempt++)
            {
                var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequestDto
                {
                    Email = "nobody@dispatchtrack.local",
                    Password = "WrongPassword999!"
                });

                if (response.StatusCode == (HttpStatusCode)429)
                {
                    sawTooManyRequests = true;
                    break;
                }

                // Before the limit is exhausted: normal invalid-credential rejection
                Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            }

            Assert.True(sawTooManyRequests, "Expected 429 after exhausting the auth rate limit (10/minute).");
        }
        finally
        {
            Environment.SetEnvironmentVariable("ConnectionStrings__Default", null);
            Environment.SetEnvironmentVariable("Jwt__Secret", null);
        }
    }
}
