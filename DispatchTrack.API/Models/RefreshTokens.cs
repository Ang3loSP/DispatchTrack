namespace DispatchTrack.Api.Models;

public class RefreshToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool Revoked { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}