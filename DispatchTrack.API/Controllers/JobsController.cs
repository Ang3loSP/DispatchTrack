using DispatchTrack.Api.Data;
using DispatchTrack.Api.DTOs.Jobs;
using DispatchTrack.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DispatchTrack.Api.Controllers;

[ApiController]
[Route("api/jobs")]
[Authorize]
public class JobsController : ControllerBase
{
    private readonly AppDbContext _context;

    public JobsController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/jobs?status=&page=&pageSize= (plan §4: Admin, Dispatcher)
    [Authorize(Roles = "Admin,Dispatcher")]
    [HttpGet]
    public async Task<ActionResult<PagedJobsDto>> GetJobs([FromQuery] JobStatus? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _context.Jobs
            .Include(j => j.AssignedDriver)
            .ThenInclude(d => d!.User)
            .AsQueryable();

        if (status.HasValue)
        {
            query = query.Where(j => j.Status == status.Value);
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(j => j.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new PagedJobsDto
        {
            Items = items.Select(j => j.ToDto()).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        });
    }

    // GET /api/jobs/{id} (Admin, Dispatcher, assigned Driver)
    [HttpGet("{id:int}")]
    public async Task<ActionResult<JobResponseDto>> GetJob(int id)
    {
        var job = await _context.Jobs
            .Include(j => j.AssignedDriver)
            .ThenInclude(d => d!.User)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (job == null)
        {
            return JobNotFound(id);
        }

        if (User.IsInRole("Driver") && job.AssignedDriverId != CurrentDriverId())
        {
            return Forbid();
        }

        return Ok(job.ToDto());
    }

    // POST /api/jobs (Admin, Dispatcher)
    [Authorize(Roles = "Admin,Dispatcher")]
    [HttpPost]
    public async Task<ActionResult<JobResponseDto>> CreateJob([FromBody] CreateJobRequestDto request)
    {
        var job = new Job
        {
            PickupAddress = request.PickupAddress.Trim(),
            PickupLat = request.PickupLat,
            PickupLng = request.PickupLng,
            DropoffAddress = request.DropoffAddress.Trim(),
            DropoffLat = request.DropoffLat,
            DropoffLng = request.DropoffLng,
            Priority = request.Priority,
            Notes = request.Notes,
            CreatedByUserId = CurrentUserId(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Jobs.Add(job);

        if (!await TrySaveAsync())
        {
            return ConcurrencyConflict();
        }

        return CreatedAtAction(nameof(GetJob), new { id = job.Id }, job.ToDto());
    }

    // PATCH /api/jobs/{id}/assign (Admin, Dispatcher) — Pending -> Assigned
    [Authorize(Roles = "Admin,Dispatcher")]
    [HttpPatch("{id:int}/assign")]
    public async Task<ActionResult<JobResponseDto>> AssignJob(int id, [FromBody] AssignJobRequestDto request)
    {
        var job = await _context.Jobs
            .Include(j => j.AssignedDriver)
            .ThenInclude(d => d!.User)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (job == null)
        {
            return JobNotFound(id);
        }

        if (job.Status != JobStatus.Pending)
        {
            return Conflict(Problem(
                "Only Pending jobs can be assigned.",
                $"Job is {job.Status}; only Pending jobs can be assigned."));
        }

        var driver = await _context.Drivers
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == request.DriverId);

        if (driver == null)
        {
            return BadRequest(Problem(
                "Driver not found.",
                $"No driver with id {request.DriverId}.",
                StatusCodes.Status400BadRequest));
        }

        // Plan §4: driver must not be Offline
        if (driver.CurrentStatus == DriverStatus.Offline)
        {
            return Conflict(Problem("Driver is offline.", $"Driver {driver.Id} is Offline and cannot be assigned."));
        }

        var now = DateTime.UtcNow;
        job.AssignedDriverId = driver.Id;
        job.AssignedDriver = driver;
        job.Status = JobStatus.Assigned;
        job.UpdatedAt = now;
        driver.CurrentStatus = DriverStatus.OnRoute;

        _context.StatusHistories.Add(new StatusHistory
        {
            JobId = job.Id,
            OldStatus = JobStatus.Pending,
            NewStatus = JobStatus.Assigned,
            ChangedByUserId = CurrentUserId(),
            ChangedAt = now
        });

        if (!await TrySaveAsync())
        {
            return ConcurrencyConflict();
        }

        return Ok(job.ToDto());
    }

    // PATCH /api/jobs/{id}/status (Driver own, Admin, Dispatcher) — server-enforced state machine (plan §6)
    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult<JobResponseDto>> UpdateStatus(int id, [FromBody] JobStatusUpdateDto request)
    {
        var targetStatus = request.Status!.Value;

        var job = await _context.Jobs
            .Include(j => j.AssignedDriver)
            .ThenInclude(d => d!.User)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (job == null)
        {
            return JobNotFound(id);
        }

        if (User.IsInRole("Driver") && job.AssignedDriverId != CurrentDriverId())
        {
            return Forbid();
        }

        if (targetStatus == JobStatus.Assigned)
        {
            return Conflict(Problem(
                "Assignment goes through the assign endpoint.",
                "Status Assigned is set by PATCH /api/jobs/{id}/assign, not by a direct status change."));
        }

        if (!JobStatusRules.CanTransition(job.Status, targetStatus))
        {
            var allowed = JobStatusRules.AllowedTargets(job.Status);
            return Conflict(Problem(
                "Illegal status transition.",
                $"Transition {job.Status} -> {targetStatus} is not allowed. Allowed from {job.Status}: {(allowed.Count == 0 ? "none (terminal)" : string.Join(", ", allowed))}."));
        }

        var now = DateTime.UtcNow;
        var previousStatus = job.Status;

        // Side effects: unassigning frees the driver; a finished job (Delivered/Failed) frees them too.
        if (targetStatus == JobStatus.Pending)
        {
            if (job.AssignedDriver != null)
            {
                job.AssignedDriver.CurrentStatus = DriverStatus.Available;
            }
            job.AssignedDriverId = null;
            job.AssignedDriver = null;
        }

        if ((targetStatus == JobStatus.Delivered || targetStatus == JobStatus.Failed) && job.AssignedDriver != null)
        {
            job.AssignedDriver.CurrentStatus = DriverStatus.Available;
        }

        job.Status = targetStatus;
        job.UpdatedAt = now;

        _context.StatusHistories.Add(new StatusHistory
        {
            JobId = job.Id,
            OldStatus = previousStatus,
            NewStatus = targetStatus,
            ChangedByUserId = CurrentUserId(),
            ChangedAt = now
        });

        if (!await TrySaveAsync())
        {
            return ConcurrencyConflict();
        }

        return Ok(job.ToDto());
    }

    private int CurrentUserId() =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")!.Value);

    // driverId claim is only present on driver accounts (set at login by TokenService)
    private int? CurrentDriverId() =>
        int.TryParse(User.FindFirst("driverId")?.Value, out var driverId) ? driverId : null;

    // Swallows EF's optimistic-concurrency failures (xmin) so callers get a 409, per plan §6.
    private async Task<bool> TrySaveAsync()
    {
        try
        {
            await _context.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }

    private NotFoundObjectResult JobNotFound(int id) =>
        NotFound(Problem("Job not found.", $"No job with id {id}."));

    private ConflictObjectResult ConcurrencyConflict() =>
        Conflict(Problem(
            "Concurrency conflict.",
            "The job was modified by someone else. Reload it and retry with the latest state."));

    private static ProblemDetails Problem(string title, string detail, int status = StatusCodes.Status409Conflict) => new()
    {
        Status = status,
        Title = title,
        Detail = detail
    };
}
