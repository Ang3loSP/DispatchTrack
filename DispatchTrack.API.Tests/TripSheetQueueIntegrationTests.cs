using DispatchTrack.Api.Data;
using DispatchTrack.Api.Models;
using DispatchTrack.Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DispatchTrack.API.Tests;

// Trip-sheet creation used to require Job.DispatchPlan == 1 - a column nothing ever set -
// so every create was rejected. The queue is the job's own status now.
public class TripSheetQueueIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public TripSheetQueueIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private static List<int> AddPendingJobs(AppDbContext db, int createdByUserId, int count)
    {
        var now = DateTime.UtcNow;
        var jobs = Enumerable.Range(0, count).Select(i => new Job
        {
            PickupAddress = $"ITEST Pickup {i}",
            PickupLat = -33.92,
            PickupLng = 18.42,
            DropoffAddress = $"ITEST Dropoff {i}",
            DropoffLat = -33.90,
            DropoffLng = 18.41,
            Status = JobStatus.Pending,
            // Unique marker so test-created rows in the shared database are identifiable
            Notes = $"ITEST {Guid.NewGuid()}",
            CreatedByUserId = createdByUserId,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();

        db.Jobs.AddRange(jobs);
        db.SaveChanges();
        return jobs.Select(j => j.Id).ToList();
    }

    [Fact]
    public async Task CreateTripSheet_ShouldAssignQueuedJobsAndRecordStatusHistory()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<ITripSheetService>();

        var dispatcher = await db.Users.FirstAsync(u => u.Email == "dispatcher@dispatchtrack.local");
        var driver = await db.Drivers.Include(d => d.User).FirstAsync();
        var jobIds = AddPendingJobs(db, dispatcher.Id, 2);

        var tripSheet = await service.CreateTripSheetAsync(
            $"ITEST-{Guid.NewGuid():N}", driver.Id, driver.User.FullName, "Local", dispatcher.Id, jobIds);

        Assert.NotNull(tripSheet);
        Assert.Equal(2, tripSheet!.Items.Count);
        Assert.Equal(new[] { 1, 2 }, tripSheet.Items.OrderBy(i => i.StopNumber).Select(i => i.StopNumber));

        db.ChangeTracker.Clear();
        var jobs = await db.Jobs.Where(j => jobIds.Contains(j.Id)).ToListAsync();
        Assert.All(jobs, job =>
        {
            Assert.Equal(JobStatus.Assigned, job.Status);
            Assert.Equal(driver.Id, job.AssignedDriverId);
            Assert.Equal(tripSheet.TripSheetId, job.TripSheetId);
        });

        var history = await db.StatusHistories.Where(h => jobIds.Contains(h.JobId)).ToListAsync();
        Assert.Equal(2, history.Count);
        Assert.All(history, entry =>
        {
            Assert.Equal(JobStatus.Pending, entry.OldStatus);
            Assert.Equal(JobStatus.Assigned, entry.NewStatus);
            Assert.Equal(dispatcher.Id, entry.ChangedByUserId);
        });
    }

    [Fact]
    public async Task CancelTripSheet_ShouldReturnJobsToTheQueue()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<ITripSheetService>();

        var dispatcher = await db.Users.FirstAsync(u => u.Email == "dispatcher@dispatchtrack.local");
        var driver = await db.Drivers.Include(d => d.User).FirstAsync();
        var jobIds = AddPendingJobs(db, dispatcher.Id, 2);

        var tripSheet = await service.CreateTripSheetAsync(
            $"ITEST-{Guid.NewGuid():N}", driver.Id, driver.User.FullName, "Local", dispatcher.Id, jobIds);
        Assert.NotNull(tripSheet);

        var cancelled = await service.CancelTripSheetAsync(tripSheet!.TripSheetId, dispatcher.Id);
        Assert.NotNull(cancelled);
        Assert.Equal(4, cancelled!.Status); // Cancelled

        db.ChangeTracker.Clear();
        var jobs = await db.Jobs.Where(j => jobIds.Contains(j.Id)).ToListAsync();
        Assert.All(jobs, job =>
        {
            Assert.Equal(JobStatus.Pending, job.Status);
            Assert.Null(job.TripSheetId);
            Assert.Null(job.AssignedDriverId);
        });

        // The defining property of the queue: a cancelled job can be dispatched again.
        var redispatch = await service.CreateTripSheetAsync(
            $"ITEST-{Guid.NewGuid():N}", driver.Id, driver.User.FullName, "Local", dispatcher.Id, jobIds);
        Assert.NotNull(redispatch);
        Assert.Equal(2, redispatch!.Items.Count);
    }
}
