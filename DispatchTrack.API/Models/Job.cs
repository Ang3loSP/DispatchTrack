using System.ComponentModel.DataAnnotations;

namespace DispatchTrack.Api.Models;

public enum JobStatus { Pending, Assigned, InTransit, Delivered, Failed }
public enum JobPriority { Low, Normal, High }

public class Job
{
    public int Id { get; set; }
    public string PickupAddress { get; set; } = string.Empty;
    public double PickupLat { get; set; }
    public double PickupLng { get; set; }
    public string DropoffAddress { get; set; } = string.Empty;
    public double DropoffLat { get; set; }
    public double DropoffLng { get; set; }
    public JobStatus Status { get; set; } = JobStatus.Pending;
    public JobPriority Priority { get; set; } = JobPriority.Normal;
    public string? Notes { get; set; }

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public int? AssignedDriverId { get; set; }
    public Driver? AssignedDriver { get; set; }

    [Timestamp]
    public byte[]? RowVersion { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<StatusHistory> StatusHistory { get; set; } = new List<StatusHistory>();
}