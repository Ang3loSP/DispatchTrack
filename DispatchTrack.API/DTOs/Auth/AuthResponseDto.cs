using DispatchTrack.Api.Models;

namespace DispatchTrack.Api.DTOs.Auth;

public class AuthResponseDto
{
    public string AccessToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; } = 900; // 15 minutes in seconds
    public UserProfileDto User { get; set; } = null!;
}

public class UserProfileDto
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int? DriverId { get; set; }
}
