using DispatchTrack.Api.Models;

namespace DispatchTrack.Api.Data.DAL;

public interface ITripSheetDAL
{
    Task<TripSheet?> GetByIdAsync(long tripSheetId);
    Task<TripSheet?> GetByTripNumberAsync(string tripNumber);
    Task<List<TripSheet>> GetOpenAsync(); // Status = Created (0)
    Task<List<TripSheet>> GetByDriverAsync(int driverId);
    Task<List<TripSheet>> GetByDateRangeAsync(DateTime from, DateTime to);
    Task<TripSheet> CreateAsync(TripSheet tripSheet);
    Task<TripSheet?> UpdateAsync(TripSheet tripSheet);
    Task<bool> DeleteAsync(long tripSheetId);

    // Items
    Task<TripSheetItem> AddItemAsync(TripSheetItem item);
    Task<bool> RemoveItemAsync(long tripSheetItemId);
    Task<TripSheetItem?> UpdateItemAsync(TripSheetItem item);
    Task<List<TripSheetItem>> GetItemsAsync(long tripSheetId);
    Task<bool> ReorderItemsAsync(long tripSheetId, Dictionary<long, int> itemIdToStopNumber);

    // Workflow
    Task<TripSheet?> DepartAsync(long tripSheetId);
    Task<TripSheet?> ReturnAsync(long tripSheetId);
    Task<TripSheet?> CompleteAsync(long tripSheetId);
    Task<TripSheet?> CancelAsync(long tripSheetId, int changedByUserId);
}