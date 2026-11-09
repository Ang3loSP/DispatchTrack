using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DispatchTrack.Api.Models;

public class TripSheet
{
    [Key]
    public long TripSheetId { get; set; }

    [Required]
    [MaxLength(50)]
    public string TripNumber { get; set; } = string.Empty;

    public int Status { get; set; } = 0; // 0=Created, 1=InProgress, 2=Returned, 3=Complete, 4=Cancelled

    [MaxLength(50)]
    public string? DispatchDestinationCategory { get; set; } // Local/Export/Collection

    public int DriverId { get; set; }

    [Required]
    [MaxLength(200)]
    public string DriverName { get; set; } = string.Empty;

    public DateTime? TripStartDateTime { get; set; }
    public DateTime? TripEndDateTime { get; set; }

    public int CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Concurrency token
    [Timestamp]
    public byte[]? Version { get; set; }

    // Navigation
    public virtual Driver? Driver { get; set; }
    public virtual ICollection<TripSheetItem> Items { get; set; } = new List<TripSheetItem>();
}