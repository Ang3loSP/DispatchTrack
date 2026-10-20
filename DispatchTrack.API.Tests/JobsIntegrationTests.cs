using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using DispatchTrack.Api.Data;
using DispatchTrack.Api.DTOs.Auth;
using DispatchTrack.Api.DTOs.Drivers;
using DispatchTrack.Api.DTOs.Jobs;
using DispatchTrack.Api.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DispatchTrack.API.Tests;

public class JobsIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public JobsIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    // ---- Helpers ----------------------------------------------------------

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

    private static CreateJobRequestDto NewJobDto() => new()
    {
        PickupAddress = "ITEST Pickup",
        PickupLat = -33.92,
        PickupLng = 18.42,
        DropoffAddress = "ITEST Dropoff",
        DropoffLat = -33.90,
        DropoffLng = 18.41,
        // Unique marker so test-created rows in the dev database are identifiable
        Notes = $"ITEST {Guid.NewGuid()}"
    };

    private async Task<JobResponseDto> CreateJobAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/jobs", NewJobDto());
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JobResponseDto>())!;
    }

    private async Task<int> GetSeededDriverIdAsync(HttpClient dispatcher)
    {
        var drivers = await dispatcher.GetFromJsonAsync<List<DriverResponseDto>>("/api/drivers");
        return drivers!.Single(d => d.Email == "driver@dispatchtrack.local").Id;
    }

    // ---- Auth & authorization (plan §7) -----------------------------------

    [Fact]
    public async Task GetJobs_WithoutToken_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/jobs");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateJob_AsDriver_Returns403()
    {
        var driver = await LoginAsAsync("driver@dispatchtrack.local");
        var response = await driver.PostAsJsonAsync("/api/jobs", NewJobDto());
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetJobs_AsDriver_Returns403()
    {
        var driver = await LoginAsAsync("driver@dispatchtrack.local");
        var response = await driver.GetAsync("/api/jobs");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ---- Job CRUD ---------------------------------------------------------

    [Fact]
    public async Task CreateJob_AsDispatcher_Returns201WithPendingStatus()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");

        var response = await dispatcher.PostAsJsonAsync("/api/jobs", NewJobDto());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var job = await response.Content.ReadFromJsonAsync<JobResponseDto>();
        Assert.NotNull(job);
        Assert.Equal("Pending", job!.Status);
        Assert.Null(job.AssignedDriver);
        Assert.True(job.Id > 0);

        // Location header points at the created resource
        var fetched = await dispatcher.GetAsync($"/api/jobs/{job.Id}");
        Assert.Equal(HttpStatusCode.OK, fetched.StatusCode);
    }

    [Fact]
    public async Task CreateJob_WithMissingRequiredFields_Returns400()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");

        var response = await dispatcher.PostAsJsonAsync("/api/jobs", new CreateJobRequestDto());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetJobs_WithStatusFilter_ReturnsOnlyMatchingStatus()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");

        var page = await dispatcher.GetFromJsonAsync<PagedJobsDto>("/api/jobs?status=Pending&page=1&pageSize=100");

        Assert.NotNull(page);
        Assert.NotEmpty(page!.Items);
        Assert.All(page.Items, item => Assert.Equal("Pending", item.Status));
        Assert.True(page.TotalCount >= page.Items.Count);
    }

    [Fact]
    public async Task GetJob_UnknownId_Returns404()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var response = await dispatcher.GetAsync("/api/jobs/999999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetJob_AsAssignedDriver_Returns200_ButOtherJobsReturn403()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var driver = await LoginAsAsync("driver@dispatchtrack.local");
        var driverId = await GetSeededDriverIdAsync(dispatcher);

        var job = await CreateJobAsync(dispatcher);

        try
        {
            // Unassigned job: a driver must not see it
            var forbidden = await driver.GetAsync($"/api/jobs/{job.Id}");
            Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

            // Assign to this driver, then they can read it
            var assign = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/assign", new AssignJobRequestDto { DriverId = driverId });
            Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

            var allowed = await driver.GetAsync($"/api/jobs/{job.Id}");
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }
        finally
        {
            await CompleteJobAsync(dispatcher, job.Id);
        }
    }

    // ---- State machine (plan §6, §7) --------------------------------------

    [Fact]
    public async Task StatusTransition_PendingToInTransit_Returns409()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var job = await CreateJobAsync(dispatcher);

        var response = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/status", new JobStatusUpdateDto { Status = JobStatus.InTransit });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task StatusTransition_DeliveredToAnything_Returns409_Terminal()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var driverId = await GetSeededDriverIdAsync(dispatcher);
        var job = await CreateJobAsync(dispatcher);

        var assign = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/assign", new AssignJobRequestDto { DriverId = driverId });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);
        await CompleteJobAsync(dispatcher, job.Id); // Assigned -> InTransit -> Delivered

        var response = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/status", new JobStatusUpdateDto { Status = JobStatus.Pending });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task StatusTransition_AssignedToInTransit_IsAcceptedAndWritesHistoryRow()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var driverId = await GetSeededDriverIdAsync(dispatcher);
        var job = await CreateJobAsync(dispatcher);

        try
        {
            var assign = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/assign", new AssignJobRequestDto { DriverId = driverId });
            Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

            var response = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/status", new JobStatusUpdateDto { Status = JobStatus.InTransit });

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var updated = await response.Content.ReadFromJsonAsync<JobResponseDto>();
            Assert.Equal("InTransit", updated!.Status);

            // Assert the automatic StatusHistory row (plan §6: written in the same transaction)
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.True(await db.StatusHistories.AnyAsync(sh =>
                sh.JobId == job.Id &&
                sh.OldStatus == JobStatus.Assigned &&
                sh.NewStatus == JobStatus.InTransit));
        }
        finally
        {
            await CompleteJobAsync(dispatcher, job.Id);
        }
    }

    [Fact]
    public async Task Unassign_ViaStatusPending_ClearsDriverAndFreesThem()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var driverId = await GetSeededDriverIdAsync(dispatcher);
        var job = await CreateJobAsync(dispatcher);

        var assign = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/assign", new AssignJobRequestDto { DriverId = driverId });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

        var unassign = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/status", new JobStatusUpdateDto { Status = JobStatus.Pending });
        Assert.Equal(HttpStatusCode.OK, unassign.StatusCode);
        var unassigned = await unassign.Content.ReadFromJsonAsync<JobResponseDto>();
        Assert.Equal("Pending", unassigned!.Status);
        Assert.Null(unassigned.AssignedDriver);

        var drivers = await dispatcher.GetFromJsonAsync<List<DriverResponseDto>>("/api/drivers");
        Assert.Equal("Available", drivers!.Single(d => d.Id == driverId).CurrentStatus);
    }

    // ---- Assignment -------------------------------------------------------

    [Fact]
    public async Task Assign_FullLifecycle_ByDriver_FreesDriverWhenDelivered()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var driver = await LoginAsAsync("driver@dispatchtrack.local");
        var driverId = await GetSeededDriverIdAsync(dispatcher);
        var job = await CreateJobAsync(dispatcher);

        var assign = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/assign", new AssignJobRequestDto { DriverId = driverId });
        Assert.Equal(HttpStatusCode.OK, assign.StatusCode);
        var assigned = await assign.Content.ReadFromJsonAsync<JobResponseDto>();
        Assert.Equal("Assigned", assigned!.Status);
        Assert.Equal(driverId, assigned.AssignedDriver!.Id);

        var onRoute = await dispatcher.GetFromJsonAsync<List<DriverResponseDto>>("/api/drivers");
        Assert.Equal("OnRoute", onRoute!.Single(d => d.Id == driverId).CurrentStatus);

        // The assigned driver advances their own job through the state machine
        var inTransit = await driver.PatchAsJsonAsync($"/api/jobs/{job.Id}/status", new JobStatusUpdateDto { Status = JobStatus.InTransit });
        Assert.Equal(HttpStatusCode.OK, inTransit.StatusCode);

        var delivered = await driver.PatchAsJsonAsync($"/api/jobs/{job.Id}/status", new JobStatusUpdateDto { Status = JobStatus.Delivered });
        Assert.Equal(HttpStatusCode.OK, delivered.StatusCode);

        // Finished job frees the driver
        var drivers = await dispatcher.GetFromJsonAsync<List<DriverResponseDto>>("/api/drivers");
        Assert.Equal("Available", drivers!.Single(d => d.Id == driverId).CurrentStatus);
    }

    [Fact]
    public async Task Assign_JobThatIsAlreadyAssigned_Returns409()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var driverId = await GetSeededDriverIdAsync(dispatcher);
        var job = await CreateJobAsync(dispatcher);

        try
        {
            var first = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/assign", new AssignJobRequestDto { DriverId = driverId });
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);

            var second = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/assign", new AssignJobRequestDto { DriverId = driverId });
            Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        }
        finally
        {
            await CompleteJobAsync(dispatcher, job.Id);
        }
    }

    [Fact]
    public async Task Assign_OfflineDriver_Returns409()
    {
        var admin = await LoginAsAsync("admin@dispatchtrack.local");
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");

        // Provision a throwaway driver via the API, then flip them Offline directly in the DB
        // (there is no API to change driver availability yet).
        var email = $"itest-offline-{Guid.NewGuid():N}@dispatchtrack.local";
        var createResponse = await admin.PostAsJsonAsync("/api/users", new
        {
            email,
            password = DataSeeder.DefaultPassword,
            fullName = "ITEST Offline Driver",
            role = "Driver",
            vehicleReg = "IT-TEST-01"
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var job = await CreateJobAsync(dispatcher);

        try
        {
            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var offlineDriver = await db.Drivers.SingleAsync(d => d.User.Email == email);
                offlineDriver.CurrentStatus = DriverStatus.Offline;
                await db.SaveChangesAsync();

                var response = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/assign", new AssignJobRequestDto { DriverId = offlineDriver.Id });
                Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            }
        }
        finally
        {
            // Remove the throwaway driver user (cascades to the Driver row)
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.Users.Include(u => u.Driver).SingleAsync(u => u.Email == email);
            db.Users.Remove(user);
            await db.SaveChangesAsync();
        }
    }

    // ---- Driver view ------------------------------------------------------

    [Fact]
    public async Task DriverMeJobs_ReturnsOnlyActiveOwnJobs()
    {
        var dispatcher = await LoginAsAsync("dispatcher@dispatchtrack.local");
        var driver = await LoginAsAsync("driver@dispatchtrack.local");
        var driverId = await GetSeededDriverIdAsync(dispatcher);
        var job = await CreateJobAsync(dispatcher);

        try
        {
            var assign = await dispatcher.PatchAsJsonAsync($"/api/jobs/{job.Id}/assign", new AssignJobRequestDto { DriverId = driverId });
            Assert.Equal(HttpStatusCode.OK, assign.StatusCode);

            var jobs = await driver.GetFromJsonAsync<List<JobResponseDto>>("/api/drivers/me/jobs");

            Assert.NotNull(jobs);
            Assert.Contains(jobs!, j => j.Id == job.Id);
            Assert.All(jobs!, j => Assert.Contains(j.Status, new[] { "Assigned", "InTransit" }));
        }
        finally
        {
            await CompleteJobAsync(dispatcher, job.Id);
        }
    }

    // ---- Helpers (cleanup) ------------------------------------------------

    /// <summary>Drives a job to a terminal state so the seeded driver is freed again after tests.</summary>
    private async Task CompleteJobAsync(HttpClient dispatcher, int jobId)
    {
        var current = await dispatcher.GetFromJsonAsync<JobResponseDto>($"/api/jobs/{jobId}");
        if (current == null || current.Status is "Delivered" or "Failed")
        {
            return;
        }

        if (current.Status == "Pending")
        {
            return; // never assigned, nothing to free
        }

        if (current.Status == "Assigned")
        {
            await dispatcher.PatchAsJsonAsync($"/api/jobs/{jobId}/status", new JobStatusUpdateDto { Status = JobStatus.InTransit });
        }

        await dispatcher.PatchAsJsonAsync($"/api/jobs/{jobId}/status", new JobStatusUpdateDto { Status = JobStatus.Delivered });
    }
}
