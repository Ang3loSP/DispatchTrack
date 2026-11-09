using DispatchTrack.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DispatchTrack.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<Job> Jobs => Set<Job>();
    public DbSet<TripSheet> TripSheets => Set<TripSheet>();
    public DbSet<TripSheetItem> TripSheetItems => Set<TripSheetItem>();
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
            .Property(j => j.Version)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .IsRowVersion()
            .ValueGeneratedOnAddOrUpdate();

        modelBuilder.Entity<Job>()
            .HasOne(j => j.AssignedDriver)
            .WithMany(d => d.Jobs)
            .HasForeignKey(j => j.AssignedDriverId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<StatusHistory>()
            .HasOne(sh => sh.Job)
            .WithMany(j => j.StatusHistory)
            .HasForeignKey(sh => sh.JobId);

        // Phase 1: TripSheet configuration
        modelBuilder.Entity<TripSheet>()
            .HasIndex(t => t.TripNumber)
            .IsUnique();

        modelBuilder.Entity<TripSheet>()
            .HasOne(t => t.Driver)
            .WithMany()
            .HasForeignKey(t => t.DriverId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TripSheet>()
            .Property(t => t.Version)
            .IsRowVersion();

        modelBuilder.Entity<TripSheetItem>()
            .HasOne(i => i.TripSheet)
            .WithMany(t => t.Items)
            .HasForeignKey(i => i.TripSheetId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TripSheetItem>()
            .HasOne(i => i.Job)
            .WithMany()
            .HasForeignKey(i => i.JobId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TripSheetItem>()
            .Property(i => i.Version)
            .IsRowVersion();

        // Job -> TripSheet relationship
        modelBuilder.Entity<Job>()
            .HasOne(j => j.TripSheet)
            .WithMany()
            .HasForeignKey(j => j.TripSheetId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}