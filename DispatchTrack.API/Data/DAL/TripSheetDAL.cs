using DispatchTrack.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DispatchTrack.Api.Data.DAL;

public class TripSheetDAL : ITripSheetDAL
{
    private readonly AppDbContext _context;

    public TripSheetDAL(AppDbContext context)
    {
        _context = context;
    }

    public async Task<TripSheet?> GetByIdAsync(long tripSheetId)
    {
        return await _context.TripSheets
            .Include(t => t.Items)
                .ThenInclude(i => i.Job)
            .Include(t => t.Driver)
            .FirstOrDefaultAsync(t => t.TripSheetId == tripSheetId);
    }

    public async Task<TripSheet?> GetByTripNumberAsync(string tripNumber)
    {
        return await _context.TripSheets
            .Include(t => t.Items)
                .ThenInclude(i => i.Job)
            .FirstOrDefaultAsync(t => t.TripNumber == tripNumber);
    }

    public async Task<List<TripSheet>> GetOpenAsync()
    {
        return await _context.TripSheets
            .Include(t => t.Items)
                .ThenInclude(i => i.Job)
            .Where(t => t.Status == 0) // Created
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<TripSheet>> GetByDriverAsync(int driverId)
    {
        return await _context.TripSheets
            .Include(t => t.Items)
                .ThenInclude(i => i.Job)
            .Where(t => t.DriverId == driverId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<TripSheet>> GetByDateRangeAsync(DateTime from, DateTime to)
    {
        return await _context.TripSheets
            .Include(t => t.Items)
                .ThenInclude(i => i.Job)
            .Where(t => t.CreatedAt >= from && t.CreatedAt <= to)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<TripSheet> CreateAsync(TripSheet tripSheet)
    {
        _context.TripSheets.Add(tripSheet);
        await _context.SaveChangesAsync();
        return tripSheet;
    }

    public async Task<TripSheet?> UpdateAsync(TripSheet tripSheet)
    {
        tripSheet.UpdatedAt = DateTime.UtcNow;
        _context.TripSheets.Update(tripSheet);
        try
        {
            await _context.SaveChangesAsync();
            return tripSheet;
        }
        catch (DbUpdateConcurrencyException)
        {
            return null;
        }
    }

    public async Task<bool> DeleteAsync(long tripSheetId)
    {
        var tripSheet = await _context.TripSheets.FindAsync(tripSheetId);
        if (tripSheet == null) return false;

        _context.TripSheets.Remove(tripSheet);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<TripSheetItem> AddItemAsync(TripSheetItem item)
    {
        item.CreatedAt = DateTime.UtcNow;
        _context.TripSheetItems.Add(item);
        await _context.SaveChangesAsync();
        return item;
    }

    public async Task<bool> RemoveItemAsync(long tripSheetItemId)
    {
        var item = await _context.TripSheetItems.FindAsync(tripSheetItemId);
        if (item == null) return false;

        _context.TripSheetItems.Remove(item);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<TripSheetItem?> UpdateItemAsync(TripSheetItem item)
    {
        _context.TripSheetItems.Update(item);
        try
        {
            await _context.SaveChangesAsync();
            return item;
        }
        catch (DbUpdateConcurrencyException)
        {
            return null;
        }
    }

    public async Task<List<TripSheetItem>> GetItemsAsync(long tripSheetId)
    {
        return await _context.TripSheetItems
            .Include(i => i.Job)
            .Where(i => i.TripSheetId == tripSheetId)
            .OrderBy(i => i.StopNumber)
            .ToListAsync();
    }

    public async Task<bool> ReorderItemsAsync(long tripSheetId, Dictionary<long, int> itemIdToStopNumber)
    {
        var items = await _context.TripSheetItems
            .Where(i => i.TripSheetId == tripSheetId)
            .ToListAsync();

        foreach (var item in items)
        {
            if (itemIdToStopNumber.TryGetValue(item.TripSheetItemId, out var newStopNumber))
            {
                item.StopNumber = newStopNumber;
            }
        }

        try
        {
            await _context.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }

    public async Task<TripSheet?> DepartAsync(long tripSheetId)
    {
        var tripSheet = await _context.TripSheets.FindAsync(tripSheetId);

        if (tripSheet == null || tripSheet.Status != 0) return null; // Only Created can depart

        tripSheet.Status = 1; // InProgress
        tripSheet.TripStartDateTime = DateTime.UtcNow;
        tripSheet.UpdatedAt = DateTime.UtcNow;

        // Jobs stay Assigned for the trip; the driver's status endpoint moves them on.
        try
        {
            await _context.SaveChangesAsync();
            return tripSheet;
        }
        catch (DbUpdateConcurrencyException)
        {
            return null;
        }
    }

    public async Task<TripSheet?> ReturnAsync(long tripSheetId)
    {
        var tripSheet = await _context.TripSheets.FindAsync(tripSheetId);
        if (tripSheet == null || tripSheet.Status != 1) return null; // Only InProgress can return

        tripSheet.Status = 2; // Returned
        tripSheet.TripEndDateTime = DateTime.UtcNow;
        tripSheet.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _context.SaveChangesAsync();
            return tripSheet;
        }
        catch (DbUpdateConcurrencyException)
        {
            return null;
        }
    }

    public async Task<TripSheet?> CompleteAsync(long tripSheetId)
    {
        var tripSheet = await _context.TripSheets.FindAsync(tripSheetId);
        if (tripSheet == null || tripSheet.Status != 2) return null; // Only Returned can complete

        tripSheet.Status = 3; // Complete
        tripSheet.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _context.SaveChangesAsync();
            return tripSheet;
        }
        catch (DbUpdateConcurrencyException)
        {
            return null;
        }
    }

    public async Task<TripSheet?> CancelAsync(long tripSheetId, int changedByUserId)
    {
        var tripSheet = await _context.TripSheets
            .Include(t => t.Items)
                .ThenInclude(i => i.Job)
            .FirstOrDefaultAsync(t => t.TripSheetId == tripSheetId);

        if (tripSheet == null) return null;

        var isTerminal = tripSheet.Status is 3 or 4; // Complete or Cancelled
        if (isTerminal) return null; // Cannot cancel terminal trips

        var now = DateTime.UtcNow;
        tripSheet.Status = 4; // Cancelled
        tripSheet.UpdatedAt = now;

        // Return all jobs to the queue, exactly as if they had never been allocated.
        foreach (var item in tripSheet.Items)
        {
            if (item.Job == null) continue;

            var previous = item.Job.Status;
            item.Job.Status = JobStatus.Pending;
            item.Job.TripSheetId = null;
            item.Job.AssignedDriverId = null;
            item.Job.UpdatedAt = now;

            if (previous != JobStatus.Pending)
            {
                _context.StatusHistories.Add(new StatusHistory
                {
                    JobId = item.Job.Id,
                    OldStatus = previous,
                    NewStatus = JobStatus.Pending,
                    ChangedByUserId = changedByUserId,
                    ChangedAt = now
                });
            }
        }

        try
        {
            await _context.SaveChangesAsync();
            return tripSheet;
        }
        catch (DbUpdateConcurrencyException)
        {
            return null;
        }
    }
}