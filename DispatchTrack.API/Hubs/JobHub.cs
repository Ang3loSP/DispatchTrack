using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DispatchTrack.Api.Hubs;

[Authorize]
public class JobHub : Hub
{
    public const string HubUrl = "/hubs/jobs";

    public async Task JoinJobGroup(int jobId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"job-{jobId}");
    }

    public async Task LeaveJobGroup(int jobId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"job-{jobId}");
    }

    public async Task JoinDispatcherGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "dispatchers");
    }

    public async Task LeaveDispatcherGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "dispatchers");
    }
}