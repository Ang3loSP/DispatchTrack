using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DispatchTrack.Api.Models;

public class TripSheetItem
{
    [Key]
    public long TripSheetItemId { get; set; }

    public long TripSheetId { get; set; }

    public int JobId { get; set; }

    public int StopNumber { get; set; }

    public int? NonCustomerDestinationId { get; set; }
    public int? NonTicketCustomerId { get; set; }

    [MaxLength(500)]
    public string? NonTicketDescription { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Concurrency token
    [Timestamp]
    public byte[]? Version { get; set; }

    // Navigation
    public virtual TripSheet? TripSheet { get; set; }
    public virtual Job? Job { get; set; }
}