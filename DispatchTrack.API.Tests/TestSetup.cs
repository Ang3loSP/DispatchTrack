// The integration tests share one remote Neon database (test isolation via Testcontainers is
// deferred to Phase 8). Demo reset deletes all rows, so test classes must not run in parallel
// against that shared database — otherwise resets race other tests' setup/assertions.
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true)]
