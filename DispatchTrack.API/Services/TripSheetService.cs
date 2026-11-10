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
        // Validate driver exists
        var driver = await _context.Drivers.FindAsync(driverId);
        if (driver == null) return null;

        // Validate all jobs exist and are in queue (DispatchPlan = 1)
        var jobs = await _context.Jobs
            .Where(j => jobIds.Contains(j.Id))
            .ToListAsync();

        if (jobs.Count != jobIds.Count) return null;

        foreach (var job in jobs)
        {
            if (job.DispatchPlan != 1) return null; // Must be in queue
        }

        // Check trip number uniqueness
        var existing = await _tripSheetDAL.GetByTripNumberAsync(tripNumber);
        if (existing != null) return null;

        var tripSheet = new TripSheet
        {
            TripNumber = tripNumber,
            Status = 0, // Created
            DispatchDestinationCategory = category,
            DriverId = driverId,
            DriverName = driverName,
            CreatedByUserId = createdByUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        tripSheet = await _tripSheetDAL.CreateAsync(tripSheet);

        // Add items
        for (int i = 0; i < jobIds.Count; i++)
        {
            var item = new TripSheetItem
            {
                TripSheetId = tripSheet.TripSheetId,
                JobId = jobIds[i],
                StopNumber = i + 1,
                CreatedAt = DateTime.UtcNow
            };
            await _tripSheetDAL.AddItemAsync(item);

            // Update job
            var job = jobs.First(j => j.Id == jobIds[i]);
            job.DispatchPlan = 2; // Planned
            job.TripSheetId = tripSheet.TripSheetId;
            job.AssignedDriverId = driverId;
            job.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return await _tripSheetDAL.GetByIdAsync(tripSheet.TripSheetId);
    }

    public async Task<TripSheet?> AddJobsToTripSheetAsync(long tripSheetId, List<int> jobIds)
    {
        var tripSheet = await _tripSheetDAL.GetByIdAsync(tripSheetId);
        if (tripSheet == null || tripSheet.Status != 0) return null; // Only Created

        var existingItems = await _tripSheetDAL.GetItemsAsync(tripSheetId);
        var nextStopNumber = existingItems.Count > 0 ? existingItems.Max(i => i.StopNumber) + 1 : 1;

        var jobs = await _context.Jobs
            .Where(j => jobIds.Contains(j.Id))
            .ToListAsync();

        if (jobs.Count != jobIds.Count) return null;

        foreach (var job in jobs)
        {
            if (job.DispatchPlan != 1) return null;
        }

        for (int i = 0; i < jobIds.Count; i++)
        {
            var item = new TripSheetItem
            {
                TripSheetId = tripSheetId,
                JobId = jobIds[i],
                StopNumber = nextStopNumber + i,
                CreatedAt = DateTime.UtcNow
            };
            await _tripSheetDAL.AddItemAsync(item);

            var job = jobs.First(j => j.Id == jobIds[i]);
            job.DispatchPlan = 2;
            job.TripSheetId = tripSheetId;
            job.AssignedDriverId = tripSheet.DriverId;
            job.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return await _tripSheetDAL.GetByIdAsync(tripSheetId);
    }

    public async Task<TripSheet?> RemoveJobFromTripSheetAsync(long tripSheetId, int jobId)
    {
        var tripSheet = await _tripSheetDAL.GetByIdAsync(tripSheetId);
        if (tripSheet == null || tripSheet.Status != 0) return null;

        var item = (await _tripSheetDAL.GetItemsAsync(tripSheetId))
            .FirstOrDefault(i => i.JobId == jobId);

        if (item == null) return null;

        await _tripSheetDAL.RemoveItemAsync(item.TripSheetItemId);

        // Update job
        var job = await _context.Jobs.FindAsync(jobId);
        if (job != null)
        {
            job.DispatchPlan = 1; // Queue
            job.TripSheetId = null;
            job.AssignedDriverId = null;
            job.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        // Renumber remaining stops
        var remainingItems = await _tripSheetDAL.GetItemsAsync(tripSheetId);
        var reorder = remainingItems
            .OrderBy(i => i.StopNumber)
            .Select((item, index) => new { item.TripSheetItemId, StopNumber = index + 1 })
            .ToDictionary(x => x.TripSheetItemId, x => x.StopNumber);

        await _tripSheetDAL.ReorderItemsAsync(tripSheetId, reorder);

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

    public async Task<TripSheet?> CancelTripSheetAsync(long tripSheetId)
    {
        return await _tripSheetDAL.CancelAsync(tripSheetId);
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

    public async Task<bool> DeleteTripSheetAsync(long tripSheetId)
    {
        var tripSheet = await _tripSheetDAL.GetByIdAsync(tripSheetId);
        if (tripSheet == null) return false;

        if (tripSheet.Status != 0) return false; // Only Created can be deleted

        return await _tripSheetDAL.DeleteAsync(tripSheetId);
    }
}