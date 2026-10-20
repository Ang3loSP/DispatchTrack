using System.ComponentModel.DataAnnotations;
using DispatchTrack.Api.Models;

namespace DispatchTrack.Api.DTOs.Jobs;

public class CreateJobRequestDto
{
    [Required, StringLength(200)]
    public string PickupAddress { get; set; } = string.Empty;

    [Range(-90, 90)]
    public double PickupLat { get; set; }

    [Range(-180, 180)]
    public double PickupLng { get; set; }

    [Required, StringLength(200)]
    public string DropoffAddress { get; set; } = string.Empty;

    [Range(-90, 90)]
    public double DropoffLat { get; set; }

    [Range(-180, 180)]
    public double DropoffLng { get; set; }

    public JobPriority Priority { get; set; } = JobPriority.Normal;

    [StringLength(1000)]
    public string? Notes { get; set; }
}

public class JobStatusUpdateDto
{
    // Nullable so an omitted "status" field fails validation instead of defaulting to Pending.
    [Required]
    public JobStatus? Status { get; set; }
}

public class AssignJobRequestDto
{
    [Required]
    public int DriverId { get; set; }
}

public class JobResponseDto
{
    public int Id { get; set; }
    public string PickupAddress { get; set; } = string.Empty;
    public double PickupLat { get; set; }
    public double PickupLng { get; set; }
    public string DropoffAddress { get; set; } = string.Empty;
    public double DropoffLat { get; set; }
    public double DropoffLng { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DriverSummaryDto? AssignedDriver { get; set; }
    public int CreatedByUserId { get; set; }
    public uint Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class DriverSummaryDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string VehicleReg { get; set; } = string.Empty;
}

public class PagedJobsDto
{
    public IReadOnlyList<JobResponseDto> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}

public static class JobMapping
{
    public static JobResponseDto ToDto(this Job job) => new()
    {
        Id = job.Id,
        PickupAddress = job.PickupAddress,
        PickupLat = job.PickupLat,
        PickupLng = job.PickupLng,
        DropoffAddress = job.DropoffAddress,
        DropoffLat = job.DropoffLat,
        DropoffLng = job.DropoffLng,
        Status = job.Status.ToString(),
        Priority = job.Priority.ToString(),
        Notes = job.Notes,
        AssignedDriver = job.AssignedDriver == null
            ? null
            : new DriverSummaryDto
            {
                Id = job.AssignedDriver.Id,
                FullName = job.AssignedDriver.User.FullName,
                VehicleReg = job.AssignedDriver.VehicleReg
            },
        CreatedByUserId = job.CreatedByUserId,
        Version = job.Version,
        CreatedAt = job.CreatedAt,
        UpdatedAt = job.UpdatedAt
    };
}
