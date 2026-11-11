using DispatchTrack.Api.Models;
using DispatchTrack.Api.Data;
using DispatchTrack.Api.Data.DAL;
using Microsoft.EntityFrameworkCore;

namespace DispatchTrack.Api.Services;

public class TripSheetService : ITripSheetService
{
    private readonly ITripSheetDAL _tripSheetDAL;
    private readonly AppDbContext _context;

    public TripSheetService(ITripSheetDAL tripSheetDAL, AppDbContext context)
    {
        _tripSheetDAL = tripSheetDAL;
        _context = context;
    }

    public async Task<TripSheet?> CreateTripSheetAsync(string tripNumber, int driverId, string driverName, string? category, int createdByUserId, List<int> jobIds)
    {
        var driver = await _context.Drivers.FindAsync(driverId);
        if (driver == null) return null;

        var jobs = await GetQueuedJobsAsync(jobIds);
        if (jobs == null) return null;

        // Check trip number uniqueness
        var existing = await _tripSheetDAL.GetByTripNumberAsync(tripNumber);
        if (existing != null) return null;

        var now = DateTime.UtcNow;
        var tripSheet = new TripSheet
        {
            TripNumber = tripNumber,
            Status = 0, // Created
            DispatchDestinationCategory = category,
            DriverId = driverId,
            DriverName = driverName,
            CreatedByUserId = createdByUserId,
            CreatedAt = now,
            UpdatedAt = now
        };

        // A trip sheet without its jobs, or jobs without their trip sheet, is unusable data.
        await using var transaction = await _context.Database.BeginTransactionAsync();

        _context.TripSheets.Add(tripSheet);
        await _context.SaveChangesAsync(); // assigns TripSheetId

        for (int i = 0; i < jobIds.Count; i++)
        {
            _context.TripSheetItems.Add(new TripSheetItem
            {
                TripSheetId = tripSheet.TripSheetId,
                JobId = jobIds[i],
                StopNumber = i + 1,
                CreatedAt = now
            });

            AssignToTripSheet(jobs[jobIds[i]], tripSheet, driverId, createdByUserId, now);
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return await _tripSheetDAL.GetByIdAsync(tripSheet.TripSheetId);
    }

    public async Task<TripSheet?> AddJobsToTripSheetAsync(long tripSheetId, List<int> jobIds, int changedByUserId)
    {
        var tripSheet = await _tripSheetDAL.GetByIdAsync(tripSheetId);
        if (tripSheet == null || tripSheet.Status != 0) return null; // Only Created

        var jobs = await GetQueuedJobsAsync(jobIds);
        if (jobs == null) return null;

        var nextStopNumber = tripSheet.Items.Count > 0 ? tripSheet.Items.Max(i => i.StopNumber) + 1 : 1;
        var now = DateTime.UtcNow;

        for (int i = 0; i < jobIds.Count; i++)
        {
            _context.TripSheetItems.Add(new TripSheetItem
            {
                TripSheetId = tripSheetId,
                JobId = jobIds[i],
                StopNumber = nextStopNumber + i,
                CreatedAt = now
            });

            AssignToTripSheet(jobs[jobIds[i]], tripSheet, tripSheet.DriverId, changedByUserId, now);
        }

        await _context.SaveChangesAsync();
        return await _tripSheetDAL.GetByIdAsync(tripSheetId);
    }

    public async Task<TripSheet?> RemoveJobFromTripSheetAsync(long tripSheetId, int jobId, int changedByUserId)
    {
        var tripSheet = await _tripSheetDAL.GetByIdAsync(tripSheetId);
        if (tripSheet == null || tripSheet.Status != 0) return null;

        var item = tripSheet.Items.FirstOrDefault(i => i.JobId == jobId);
        if (item == null) return null;

        _context.TripSheetItems.Remove(item);

        if (item.Job != null)
        {
            ReturnToQueue(item.Job, changedByUserId, DateTime.UtcNow);
        }

        // Close the gap left by the removed stop.
        var stopNumber = 1;
        foreach (var remaining in tripSheet.Items.Where(i => i != item).OrderBy(i => i.StopNumber))
        {
            remaining.StopNumber = stopNumber++;
        }

        await _context.SaveChangesAsync();
        return await _tripSheetDAL.GetByIdAsync(tripSheetId);
    }

    public async Task<TripSheet?> ReorderStopsAsync(long tripSheetId, Dictionary<long, int> itemIdToStopNumber)
    {
        var tripSheet = await _tripSheetDAL.GetByIdAsync(tripSheetId);
        if (tripSheet == null || tripSheet.Status != 0) return null;

        await _tripSheetDAL.ReorderItemsAsync(tripSheetId, itemIdToStopNumber);
        return await _tripSheetDAL.GetByIdAsync(tripSheetId);
    }

    public async Task<TripSheet?> DepartTripSheetAsync(long tripSheetId)
    {
        return await _tripSheetDAL.DepartAsync(tripSheetId);
    }

    public async Task<TripSheet?> ReturnTripSheetAsync(long tripSheetId)
    {
        return await _tripSheetDAL.ReturnAsync(tripSheetId);
    }

    public async Task<TripSheet?> CompleteTripSheetAsync(long tripSheetId)
    {
        return await _tripSheetDAL.CompleteAsync(tripSheetId);
    }

    public async Task<TripSheet?> CancelTripSheetAsync(long tripSheetId, int changedByUserId)
    {
        return await _tripSheetDAL.CancelAsync(tripSheetId, changedByUserId);
    }

    public async Task<TripSheet?> GetTripSheetAsync(long tripSheetId)
    {
        return await _tripSheetDAL.GetByIdAsync(tripSheetId);
    }

    public async Task<List<TripSheet>> GetOpenTripSheetsAsync()
    {
        return await _tripSheetDAL.GetOpenAsync();
    }

    public async Task<List<TripSheet>> GetDriverTripSheetsAsync(int driverId)
    {
        return await _tripSheetDAL.GetByDriverAsync(driverId);
    }

    public async Task<bool> DeleteTripSheetAsync(long tripSheetId, int changedByUserId)
    {
        var tripSheet = await _tripSheetDAL.GetByIdAsync(tripSheetId);
        if (tripSheet == null) return false;

        if (tripSheet.Status != 0) return false; // Only Created can be deleted

        // Deleting the sheet must not leave its jobs Assigned to a trip that no longer exists.
        await using var transaction = await _context.Database.BeginTransactionAsync();

        var now = DateTime.UtcNow;
        foreach (var item in tripSheet.Items.Where(i => i.Job != null))
        {
            ReturnToQueue(item.Job!, changedByUserId, now);
        }

        await _context.SaveChangesAsync();

        var deleted = await _tripSheetDAL.DeleteAsync(tripSheetId);
        await transaction.CommitAsync();
        return deleted;
    }

    // The dispatch queue: unassigned work that no trip sheet has claimed yet.
    private async Task<Dictionary<int, Job>?> GetQueuedJobsAsync(List<int> jobIds)
    {
        var jobs = await _context.Jobs
            .Where(j => jobIds.Contains(j.Id))
            .ToDictionaryAsync(j => j.Id);

        var allQueued = jobs.Count == jobIds.Count
            && jobs.Values.All(j => j.Status == JobStatus.Pending && j.TripSheetId == null);

        return allQueued ? jobs : null;
    }

    // Same status change as PATCH /api/jobs/{id}/assign, recorded the same way.
    private void AssignToTripSheet(Job job, TripSheet tripSheet, int driverId, int changedByUserId, DateTime now)
    {
        var previous = job.Status;
        job.Status = JobStatus.Assigned;
        job.TripSheetId = tripSheet.TripSheetId;
        job.AssignedDriverId = driverId;
        job.UpdatedAt = now;

        if (previous != JobStatus.Assigned)
        {
            _context.StatusHistories.Add(new StatusHistory
            {
                JobId = job.Id,
                OldStatus = previous,
                NewStatus = JobStatus.Assigned,
                ChangedByUserId = changedByUserId,
                ChangedAt = now
            });
        }
    }

    private void ReturnToQueue(Job job, int changedByUserId, DateTime now)
    {
        var previous = job.Status;
        job.Status = JobStatus.Pending;
        job.TripSheetId = null;
        job.AssignedDriverId = null;
        job.UpdatedAt = now;

        if (previous != JobStatus.Pending)
        {
            _context.StatusHistories.Add(new StatusHistory
            {
                JobId = job.Id,
                OldStatus = previous,
                NewStatus = JobStatus.Pending,
                ChangedByUserId = changedByUserId,
                ChangedAt = now
            });
        }
    }
}
