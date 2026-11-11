using DispatchTrack.Api.Services;

namespace DispatchTrack.API.Tests;

public class RedisConnectionStringsTests
{
    [Theory]
    [InlineData("redis://redis:6379", "redis:6379")]
    [InlineData("rediss://default:pass@host.upstash.io:6379", "host.upstash.io:6379,password=pass,ssl=true")]
    [InlineData("redis://:pass@redis:6380", "redis:6380,password=pass")]
    [InlineData("redis://app:se%40cret@redis:6379", "redis:6379,user=app,password=se@cret")]
    [InlineData("localhost:6379", "localhost:6379")]
    [InlineData("host:6379,password=pass,ssl=true", "host:6379,password=pass,ssl=true")]
    [InlineData(null, null)]
    public void Normalize_ConvertsRedisUrlsAndLeavesConnectionStringsAlone(string? input, string? expected)
    {
        Assert.Equal(expected, RedisConnectionStrings.Normalize(input));
    }
}
