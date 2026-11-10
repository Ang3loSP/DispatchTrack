using DispatchTrack.Api.Models;
using DispatchTrack.Api.Data.DAL;

namespace DispatchTrack.Api.Services;

public interface ITripSheetService
{
    Task<TripSheet?> CreateTripSheetAsync(string tripNumber, int driverId, string driverName, string? category, int createdByUserId, List<int> jobIds);
    Task<TripSheet?> AddJobsToTripSheetAsync(long tripSheetId, List<int> jobIds);
    Task<TripSheet?> RemoveJobFromTripSheetAsync(long tripSheetId, int jobId);
    Task<TripSheet?> ReorderStopsAsync(long tripSheetId, Dictionary<long, int> itemIdToStopNumber);
    Task<TripSheet?> DepartTripSheetAsync(long tripSheetId);
    Task<TripSheet?> ReturnTripSheetAsync(long tripSheetId);
    Task<TripSheet?> CompleteTripSheetAsync(long tripSheetId);
    Task<TripSheet?> CancelTripSheetAsync(long tripSheetId);
    Task<TripSheet?> GetTripSheetAsync(long tripSheetId);
    Task<List<TripSheet>> GetOpenTripSheetsAsync();
    Task<List<TripSheet>> GetDriverTripSheetsAsync(int driverId);
    Task<bool> DeleteTripSheetAsync(long tripSheetId);
}