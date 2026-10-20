using DispatchTrack.Api.Data;
using DispatchTrack.Api.DTOs.Auth;
using DispatchTrack.Api.Models;
using DispatchTrack.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DispatchTrack.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IPasswordHasher<User> _passwordHasher;
    private const string RefreshTokenCookieName = "refreshToken";

    public AuthController(
        AppDbContext context,
        ITokenService tokenService,
        IPasswordHasher<User> passwordHasher)
    {
        _context = context;
        _tokenService = tokenService;
        _passwordHasher = passwordHasher;
    }

    // Plan §5: brute-force protection on login (enforced outside Development only).
    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginRequestDto request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .Include(u => u.Driver)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        if (user == null)
        {
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Unauthorized",
                Detail = "Invalid email or password."
            });
        }

        var verificationResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Unauthorized",
                Detail = "Invalid email or password."
            });
        }

        var accessToken = _tokenService.GenerateAccessToken(user);
        var (rawRefreshToken, tokenHash) = _tokenService.GenerateRefreshToken();

        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            Revoked = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync();

        SetRefreshTokenCookie(rawRefreshToken, refreshTokenEntity.ExpiresAt);

        return Ok(new AuthResponseDto
        {
            AccessToken = accessToken,
            ExpiresIn = 900,
            User = new UserProfileDto
            {
                Id = user.Id,
                Email = user.Email,
                FullName = user.FullName,
                Role = user.Role.ToString(),
                DriverId = user.Driver?.Id
            }
        });
    }

    [EnableRateLimiting("auth")]
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponseDto>> Refresh()
    {
        if (!Request.Cookies.TryGetValue(RefreshTokenCookieName, out var rawRefreshToken) || string.IsNullOrWhiteSpace(rawRefreshToken))
        {
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Unauthorized",
                Detail = "Refresh token is missing."
            });
        }

        var tokenHash = _tokenService.HashToken(rawRefreshToken);
        var existingToken = await _context.RefreshTokens
            .Include(rt => rt.User)
            .ThenInclude(u => u.Driver)
            .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash);

        if (existingToken == null || existingToken.Revoked || existingToken.ExpiresAt < DateTime.UtcNow)
        {
            // Security measure: if token was already revoked, someone might be attempting token reuse
            if (existingToken != null && existingToken.Revoked)
            {
                // Invalidate all tokens for this user
                var userTokens = await _context.RefreshTokens
                    .Where(rt => rt.UserId == existingToken.UserId && !rt.Revoked)
                    .ToListAsync();

                foreach (var token in userTokens)
                {
                    token.Revoked = true;
                }

                await _context.SaveChangesAsync();
            }

            Response.Cookies.Delete(RefreshTokenCookieName);
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Unauthorized",
                Detail = "Refresh token is expired, revoked, or invalid."
            });
        }

        // Revoke the old token (rotation)
        existingToken.Revoked = true;

        // Generate new pair
        var newAccessToken = _tokenService.GenerateAccessToken(existingToken.User);
        var (newRawToken, newTokenHash) = _tokenService.GenerateRefreshToken();

        var newRefreshTokenEntity = new RefreshToken
        {
            UserId = existingToken.UserId,
            TokenHash = newTokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            Revoked = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.RefreshTokens.Add(newRefreshTokenEntity);
        await _context.SaveChangesAsync();

        SetRefreshTokenCookie(newRawToken, newRefreshTokenEntity.ExpiresAt);

        return Ok(new AuthResponseDto
        {
            AccessToken = newAccessToken,
            ExpiresIn = 900,
            User = new UserProfileDto
            {
                Id = existingToken.User.Id,
                Email = existingToken.User.Email,
                FullName = existingToken.User.FullName,
                Role = existingToken.User.Role.ToString(),
                DriverId = existingToken.User.Driver?.Id
            }
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        if (Request.Cookies.TryGetValue(RefreshTokenCookieName, out var rawRefreshToken) && !string.IsNullOrWhiteSpace(rawRefreshToken))
        {
            var tokenHash = _tokenService.HashToken(rawRefreshToken);
            var tokenEntity = await _context.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash);
            if (tokenEntity != null)
            {
                tokenEntity.Revoked = true;
                await _context.SaveChangesAsync();
            }
        }

        Response.Cookies.Delete(RefreshTokenCookieName);
        return Ok(new { message = "Logged out successfully" });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserProfileDto>> Me()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users
            .Include(u => u.Driver)
            .FirstOrDefaultAsync(u => u.Id == userId);

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

    private void SetRefreshTokenCookie(string token, DateTime expiresAt)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Expires = expiresAt
        };

        Response.Cookies.Append(RefreshTokenCookieName, token, cookieOptions);
    }
}
