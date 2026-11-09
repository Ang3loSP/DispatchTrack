using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DispatchTrack.Api.Hubs;

[Authorize]
public class DriverHub : Hub
{
    public const string HubUrl = "/hubs/drivers";

    public async Task JoinDriverGroup(int driverId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"driver-{driverId}");
    }

    public async Task LeaveDriverGroup(int driverId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"driver-{driverId}");
    }

    public async Task UpdateLocation(double lat, double lng)
    {
        var driverId = Context.User?.FindFirst("driverId")?.Value;
        if (int.TryParse(driverId, out var id))
        {
            await Clients.Group("dispatchers").SendAsync("DriverLocationUpdated", id, lat, lng);
        }
    }

    public async Task UpdateStatus(string status)
    {
        var driverId = Context.User?.FindFirst("driverId")?.Value;
        if (int.TryParse(driverId, out var id))
        {
            await Clients.Group("dispatchers").SendAsync("DriverStatusUpdated", id, status);
        }
    }
}