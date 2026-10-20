using DispatchTrack.Api.Data;
using DispatchTrack.Api.DTOs.Drivers;
using DispatchTrack.Api.DTOs.Jobs;
using DispatchTrack.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DispatchTrack.Api.Controllers;

[ApiController]
[Route("api/drivers")]
[Authorize]
public class DriversController : ControllerBase
{
    private readonly AppDbContext _context;

    public DriversController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/drivers (Admin, Dispatcher) — all drivers with their live status
    [Authorize(Roles = "Admin,Dispatcher")]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DriverResponseDto>>> GetDrivers()
    {
        var drivers = await _context.Drivers
            .Include(d => d.User)
            .OrderBy(d => d.Id)
            .Select(d => new DriverResponseDto
            {
                Id = d.Id,
                FullName = d.User.FullName,
                Email = d.User.Email,
                VehicleReg = d.VehicleReg,
                CurrentStatus = d.CurrentStatus.ToString()
            })
            .ToListAsync();

        return Ok(drivers);
    }

    // GET /api/drivers/me/jobs (Driver) — the caller's active (Assigned/InTransit) jobs
    [Authorize(Roles = "Driver")]
    [HttpGet("me/jobs")]
    public async Task<ActionResult<IEnumerable<JobResponseDto>>> GetMyJobs()
    {
        if (!int.TryParse(User.FindFirst("driverId")?.Value, out var driverId))
        {
            return Forbid();
        }

        var jobs = await _context.Jobs
            .Where(j => j.AssignedDriverId == driverId &&
                        (j.Status == JobStatus.Assigned || j.Status == JobStatus.InTransit))
            .OrderByDescending(j => j.Priority)
            .ThenBy(j => j.CreatedAt)
            .ToListAsync();

        return Ok(jobs.Select(j => j.ToDto()));
    }
}
