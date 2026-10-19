using DispatchTrack.Api.Models;

namespace DispatchTrack.Api.Services;

public interface ITokenService
{
    string GenerateAccessToken(User user);
    (string rawToken, string tokenHash) GenerateRefreshToken();
    string HashToken(string rawToken);
}
