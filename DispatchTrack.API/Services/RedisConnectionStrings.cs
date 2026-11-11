namespace DispatchTrack.Api.Services;

public static class RedisConnectionStrings
{
    // StackExchange.Redis only parses "host:port,option=value" pairs. The redis:// / rediss://
    // URLs that Upstash and docker-compose hand out are otherwise treated as a hostname, so the
    // cache silently fails open. Convert them here rather than trusting every deployer to.
    public static string? Normalize(string? value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || (uri.Scheme != "redis" && uri.Scheme != "rediss")
            || string.IsNullOrEmpty(uri.Host))
        {
            return value;
        }

        var parts = new List<string> { $"{uri.Host}:{uri.Port}" };
        var userInfo = uri.UserInfo.Split(':', 2);
        if (userInfo.Length == 2)
        {
            if (!string.IsNullOrEmpty(userInfo[0]) && userInfo[0] != "default")
            {
                parts.Add($"user={Uri.UnescapeDataString(userInfo[0])}");
            }
            parts.Add($"password={Uri.UnescapeDataString(userInfo[1])}");
        }

        if (uri.Scheme == "rediss")
        {
            parts.Add("ssl=true");
        }

        return string.Join(",", parts);
    }
}
