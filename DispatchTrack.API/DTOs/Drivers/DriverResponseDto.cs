namespace DispatchTrack.Api.DTOs.Drivers;

public class DriverResponseDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string VehicleReg { get; set; } = string.Empty;
    public string CurrentStatus { get; set; } = string.Empty;
}
