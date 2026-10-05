namespace DispatchTrack.Api.Models;

public class StatusHistory
{
    public int Id { get; set; }
    public int JobId { get; set; }
    public Job Job { get; set; } = null!;
    public JobStatus OldStatus { get; set; }
    public JobStatus NewStatus { get; set; }
    public int ChangedByUserId { get; set; }
    public User ChangedByUser { get; set; } = null!;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
}