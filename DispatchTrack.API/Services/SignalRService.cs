using Microsoft.AspNetCore.SignalR;
using DispatchTrack.Api.Hubs;

namespace DispatchTrack.Api.Services;

public interface ISignalRService
{
    Task NotifyJobStatusChanged(int jobId, string status, string? driverName = null);
    Task NotifyJobAssigned(int jobId, int driverId, string driverName);
    Task NotifyJobCreated(int jobId);
    Task NotifyDispatcherCountsChanged();
}

public class SignalRService : ISignalRService
{
    private readonly IHubContext<JobHub> _jobHub;
    private readonly IHubContext<DriverHub> _driverHub;

    public SignalRService(IHubContext<JobHub> jobHub, IHubContext<DriverHub> driverHub)
    {
        _jobHub = jobHub;
        _driverHub = driverHub;
    }

    public async Task NotifyJobStatusChanged(int jobId, string status, string? driverName = null)
    {
        await _jobHub.Clients.Group($"job-{jobId}").SendAsync("JobStatusChanged", jobId, status, driverName);
        await _jobHub.Clients.Group("dispatchers").SendAsync("JobStatusChanged", jobId, status, driverName);
        await NotifyDispatcherCountsChanged();
    }

    public async Task NotifyJobAssigned(int jobId, int driverId, string driverName)
    {
        await _jobHub.Clients.Group($"job-{jobId}").SendAsync("JobAssigned", jobId, driverId, driverName);
        await _jobHub.Clients.Group("dispatchers").SendAsync("JobAssigned", jobId, driverId, driverName);
        await _driverHub.Clients.Group($"driver-{driverId}").SendAsync("JobAssigned", jobId);
        await NotifyDispatcherCountsChanged();
    }

    public async Task NotifyJobCreated(int jobId)
    {
        await _jobHub.Clients.Group("dispatchers").SendAsync("JobCreated", jobId);
        await NotifyDispatcherCountsChanged();
    }

    public async Task NotifyDispatcherCountsChanged()
    {
        await _jobHub.Clients.Group("dispatchers").SendAsync("CountsChanged");
    }
}