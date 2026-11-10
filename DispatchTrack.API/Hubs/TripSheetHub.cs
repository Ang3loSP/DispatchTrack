using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DispatchTrack.Api.Hubs;

[Authorize]
public class TripSheetHub : Hub
{
    public const string HubUrl = "/hubs/tripsheet";

    public async Task JoinTripSheetGroup(long tripSheetId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"tripsheet-{tripSheetId}");
    }

    public async Task LeaveTripSheetGroup(long tripSheetId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"tripsheet-{tripSheetId}");
    }

    public async Task JoinDispatchersGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "dispatchers");
    }

    public async Task LeaveDispatchersGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "dispatchers");
    }
}