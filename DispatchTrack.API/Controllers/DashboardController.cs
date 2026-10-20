using DispatchTrack.Api.Data;
using DispatchTrack.Api.DTOs.Dashboard;
using DispatchTrack.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;

namespace DispatchTrack.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Admin,Dispatcher")]
public class DashboardController : ControllerBase
{
    private const string SummaryCacheKey = "dashboard:summary";
    private static readonly TimeSpan SummaryCacheTtl = TimeSpan.FromSeconds(60);

    private readonly AppDbContext _context;
    private readonly IDistributedCache _cache;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(AppDbContext context, IDistributedCache cache, ILogger<DashboardController> logger)
    {
        _context = context;
        _cache = cache;
        _logger = logger;
    }

    // GET /api/dashboard/summary (plan §4) — Redis cached, DB fallback (plan §3: cache is non-critical)
    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary()
    {
        string? cached = null;
        try
        {
            cached = await _cache.GetStringAsync(SummaryCacheKey);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis read failed; serving dashboard summary from database");
        }

        if (cached != null)
        {
            return Ok(JsonSerializer.Deserialize<DashboardSummaryDto>(cached));
        }

        var summary = await BuildSummaryAsync();

        try
        {
            await _cache.SetStringAsync(
                SummaryCacheKey,
                JsonSerializer.Serialize(summary),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = SummaryCacheTtl });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis write failed; dashboard summary served uncached");
        }

        return Ok(summary);
    }

    private async Task<DashboardSummaryDto> BuildSummaryAsync()
    {
        var jobsByStatus = await _context.Jobs
            .GroupBy(j => j.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status.ToString(), x => x.Count);

        var driversByStatus = await _context.Drivers
            .GroupBy(d => d.CurrentStatus)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status.ToString(), x => x.Count);

        // Fill missing enum values with 0 so clients always get a stable shape.
        return new DashboardSummaryDto
        {
            TotalJobs = jobsByStatus.Values.Sum(),
            JobsByStatus = Enum.GetValues<JobStatus>()
                .ToDictionary(s => s.ToString(), s => jobsByStatus.GetValueOrDefault(s.ToString())),
            JobsCreatedToday = await _context.Jobs.CountAsync(j => j.CreatedAt >= DateTime.UtcNow.Date),
            TotalDrivers = driversByStatus.Values.Sum(),
            DriversByStatus = Enum.GetValues<DriverStatus>()
                .ToDictionary(s => s.ToString(), s => driversByStatus.GetValueOrDefault(s.ToString()))
        };
    }
}
