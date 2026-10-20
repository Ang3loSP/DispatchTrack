namespace DispatchTrack.Api.DTOs.Dashboard;

public class DashboardSummaryDto
{
    public int TotalJobs { get; set; }
    public Dictionary<string, int> JobsByStatus { get; set; } = new();
    public int JobsCreatedToday { get; set; }
    public int TotalDrivers { get; set; }
    public Dictionary<string, int> DriversByStatus { get; set; } = new();
}
