namespace DispatchTrack.Api.Models;

public enum DriverStatus { Available, OnRoute, Offline }

public class Driver
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string VehicleReg { get; set; } = string.Empty;
    public DriverStatus CurrentStatus { get; set; } = DriverStatus.Offline;

    public ICollection<Job> Jobs { get; set; } = new List<Job>();
}