using DispatchTrack.Api.Data;
using DispatchTrack.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DispatchTrack.Api.Controllers;

[ApiController]
[Route("api/demo")]
[Authorize(Roles = "Admin")]
public class DemoController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher<User> _passwordHasher;

    public DemoController(AppDbContext context, IPasswordHasher<User> passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    // POST /api/demo/reset (plan §4): wipe all data and restore the seeded demo state.
    // Also the cleanup mechanism for tests/demo sessions (plan §5).
    [HttpPost("reset")]
    public async Task<IActionResult> ResetDemoData()
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();

        // Order matters: FKs require children first (StatusHistories -> Jobs, then Drivers/RefreshTokens -> Users).
        await _context.StatusHistories.ExecuteDeleteAsync();
        await _context.Jobs.ExecuteDeleteAsync();
        await _context.RefreshTokens.ExecuteDeleteAsync();
        await _context.Drivers.ExecuteDeleteAsync();
        await _context.Users.ExecuteDeleteAsync();

        await DataSeeder.SeedAsync(_context, _passwordHasher);

        await transaction.CommitAsync();

        return Ok(new { message = "Demo data restored to its seeded state." });
    }
}
