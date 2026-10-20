using DispatchTrack.Api.Models;

namespace DispatchTrack.API.Tests;

public class JobStatusRulesTests
{
    [Theory]
    [InlineData(JobStatus.Pending, JobStatus.Assigned)]
    [InlineData(JobStatus.Assigned, JobStatus.InTransit)]
    [InlineData(JobStatus.Assigned, JobStatus.Pending)] // unassign
    [InlineData(JobStatus.InTransit, JobStatus.Delivered)]
    [InlineData(JobStatus.InTransit, JobStatus.Failed)]
    public void CanTransition_AllowsLegalTransitions(JobStatus from, JobStatus to)
    {
        Assert.True(JobStatusRules.CanTransition(from, to));
    }

    [Theory]
    [InlineData(JobStatus.Pending, JobStatus.InTransit)]
    [InlineData(JobStatus.Pending, JobStatus.Delivered)]
    [InlineData(JobStatus.Pending, JobStatus.Failed)]
    [InlineData(JobStatus.Assigned, JobStatus.Delivered)]
    [InlineData(JobStatus.Delivered, JobStatus.Pending)]
    [InlineData(JobStatus.Delivered, JobStatus.InTransit)]
    [InlineData(JobStatus.Failed, JobStatus.Pending)]
    [InlineData(JobStatus.Failed, JobStatus.InTransit)]
    [InlineData(JobStatus.Pending, JobStatus.Pending)]
    public void CanTransition_RejectsIllegalTransitions(JobStatus from, JobStatus to)
    {
        Assert.False(JobStatusRules.CanTransition(from, to));
    }

    [Fact]
    public void DeliveredAndFailed_AreTerminal()
    {
        Assert.Empty(JobStatusRules.AllowedTargets(JobStatus.Delivered));
        Assert.Empty(JobStatusRules.AllowedTargets(JobStatus.Failed));
    }
}
