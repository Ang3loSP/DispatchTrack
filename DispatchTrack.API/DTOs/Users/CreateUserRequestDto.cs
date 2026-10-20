using System.ComponentModel.DataAnnotations;
using DispatchTrack.Api.Models;

namespace DispatchTrack.Api.DTOs.Users;

public class CreateUserRequestDto
{
    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 8)]
    public string Password { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    public UserRole Role { get; set; }

    /// <summary>Vehicle registration, only used when creating a Driver account.</summary>
    [StringLength(20)]
    public string? VehicleReg { get; set; }
}
