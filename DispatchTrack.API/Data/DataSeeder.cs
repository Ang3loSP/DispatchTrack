using DispatchTrack.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace DispatchTrack.Api.Data;

public static class DataSeeder
{
    public const string DefaultPassword = "Password123!";

    public static async Task SeedAsync(AppDbContext context, IPasswordHasher<User> passwordHasher)
    {
        if (await context.Users.AnyAsync())
        {
            return; // Already seeded
        }

        var admin = new User
        {
            Email = "admin@dispatchtrack.local",
            FullName = "Admin User",
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow
        };
        admin.PasswordHash = passwordHasher.HashPassword(admin, DefaultPassword);

        var dispatcher = new User
        {
            Email = "dispatcher@dispatchtrack.local",
            FullName = "Dispatcher User",
            Role = UserRole.Dispatcher,
            CreatedAt = DateTime.UtcNow
        };
        dispatcher.PasswordHash = passwordHasher.HashPassword(dispatcher, DefaultPassword);

        var driverUser = new User
        {
            Email = "driver@dispatchtrack.local",
            FullName = "John Doe (Driver)",
            Role = UserRole.Driver,
            CreatedAt = DateTime.UtcNow
        };
        driverUser.PasswordHash = passwordHasher.HashPassword(driverUser, DefaultPassword);

        context.Users.AddRange(admin, dispatcher, driverUser);
        await context.SaveChangesAsync();

        var driverProfile = new Driver
        {
            UserId = driverUser.Id,
            VehicleReg = "DT-VAN-01",
            CurrentStatus = DriverStatus.Available
        };

        context.Drivers.Add(driverProfile);
        await context.SaveChangesAsync();

        // Seed initial sample jobs
        var sampleJob1 = new Job
        {
            PickupAddress = "10 Industrial Ring, Zone 1",
            PickupLat = -33.9249,
            PickupLng = 18.4241,
            DropoffAddress = "45 Harbour View Rd, Waterfront",
            DropoffLat = -33.9015,
            DropoffLng = 18.4190,
            Status = JobStatus.Pending,
            Priority = JobPriority.Normal,
            Notes = "Fragile electronics. Handle with care.",
            CreatedByUserId = dispatcher.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var sampleJob2 = new Job
        {
            PickupAddress = "12 Central Square, CBD",
            PickupLat = -33.9221,
            PickupLng = 18.4231,
            DropoffAddress = "88 Sunset Blvd, Camps Bay",
            DropoffLat = -33.9510,
            DropoffLng = 18.3780,
            Status = JobStatus.Assigned,
            Priority = JobPriority.High,
            Notes = "Medical supplies. Urgent morning delivery.",
            CreatedByUserId = dispatcher.Id,
            AssignedDriverId = driverProfile.Id,
            CreatedAt = DateTime.UtcNow.AddHours(-2),
            UpdatedAt = DateTime.UtcNow.AddHours(-1)
        };

        sampleJob2.StatusHistory.Add(new StatusHistory
        {
            OldStatus = JobStatus.Pending,
            NewStatus = JobStatus.Assigned,
            ChangedByUserId = dispatcher.Id,
            ChangedAt = DateTime.UtcNow.AddHours(-1)
        });

        context.Jobs.AddRange(sampleJob1, sampleJob2);
        await context.SaveChangesAsync();
    }
}
