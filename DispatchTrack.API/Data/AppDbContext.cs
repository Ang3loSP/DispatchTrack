using DispatchTrack.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Reflection.Emit;

namespace DispatchTrack.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<Job> Jobs => Set<Job>();
    public DbSet<StatusHistory> StatusHistories => Set<StatusHistory>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<Driver>()
            .HasOne(d => d.User)
            .WithOne(u => u.Driver)
            .HasForeignKey<Driver>(d => d.UserId);

        modelBuilder.Entity<Job>()
            .HasOne(j => j.CreatedByUser)
            .WithMany()
            .HasForeignKey(j => j.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Job>()
            .HasOne(j => j.AssignedDriver)
            .WithMany(d => d.Jobs)
            .HasForeignKey(j => j.AssignedDriverId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<StatusHistory>()
            .HasOne(sh => sh.Job)
            .WithMany(j => j.StatusHistory)
            .HasForeignKey(sh => sh.JobId);
    }
}