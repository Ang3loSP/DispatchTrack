using DispatchTrack.Api.Data;
using DispatchTrack.Api.DTOs.Auth;
using DispatchTrack.Api.DTOs.Users;
using DispatchTrack.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DispatchTrack.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher<User> _passwordHasher;

    public UsersController(AppDbContext context, IPasswordHasher<User> passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    // POST /api/users (Admin only; public registration is disabled by design)
    [HttpPost]
    public async Task<ActionResult<UserProfileDto>> CreateUser([FromBody] CreateUserRequestDto request)
    {
        if (request.Role == UserRole.Admin)
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid role",
                Detail = "Only Dispatcher and Driver accounts can be created."
            });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await _context.Users.AnyAsync(u => u.Email == normalizedEmail))
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Duplicate email",
                Detail = $"A user with email {normalizedEmail} already exists."
            });
        }

        var user = new User
        {
            Email = normalizedEmail,
            FullName = request.FullName.Trim(),
            Role = request.Role,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _context.Users.Add(user);

        if (request.Role == UserRole.Driver)
        {
            _context.Drivers.Add(new Driver
            {
                User = user,
                VehicleReg = request.VehicleReg?.Trim() ?? string.Empty,
                CurrentStatus = DriverStatus.Available
            });
        }

        await _context.SaveChangesAsync();

        var profile = new UserProfileDto
        {
            Id = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            DriverId = user.Driver?.Id
        };

        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, profile);
    }

    // GET /api/users/{id} — needed so CreateUser can return a Location header
    [HttpGet("{id:int}")]
    public async Task<ActionResult<UserProfileDto>> GetUser(int id)
    {
        var user = await _context.Users
            .Include(u => u.Driver)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound();
        }

        return Ok(new UserProfileDto
        {
            Id = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            DriverId = user.Driver?.Id
        });
    }
}
