namespace DispatchTrack.Api.Models;

/// <summary>
/// Server-enforced job state machine (plan §6): Pending -> Assigned -> InTransit -> Delivered/Failed,
/// Assigned -> Pending (unassign). Delivered and Failed are terminal.
/// </summary>
public static class JobStatusRules
{
    private static readonly Dictionary<JobStatus, JobStatus[]> AllowedTransitions = new()
    {
        [JobStatus.Pending] = [JobStatus.Assigned],
        [JobStatus.Assigned] = [JobStatus.InTransit, JobStatus.Pending],
        [JobStatus.InTransit] = [JobStatus.Delivered, JobStatus.Failed],
        [JobStatus.Delivered] = [],
        [JobStatus.Failed] = []
    };

    public static bool CanTransition(JobStatus from, JobStatus to) =>
        AllowedTransitions.TryGetValue(from, out var targets) && targets.Contains(to);

    public static IReadOnlyList<JobStatus> AllowedTargets(JobStatus from) =>
        AllowedTransitions.TryGetValue(from, out var targets) ? targets : [];
}
