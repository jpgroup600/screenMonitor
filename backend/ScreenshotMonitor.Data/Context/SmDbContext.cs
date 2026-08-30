using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using ScreenshotMonitor.Data.Entities;
using System;
using System.IO;

namespace ScreenshotMonitor.Data.Context
{
    public class SmDbContext : DbContext
    {
        public SmDbContext(DbContextOptions<SmDbContext> options) : base(options) { }
      
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Project -> Admin (User)
            modelBuilder.Entity<Project>()
                .HasOne(p => p.Admin)
                .WithMany()
                .HasForeignKey(p => p.AdminId)
                .OnDelete(DeleteBehavior.Restrict); // Prevent admin deletion from deleting all projects

            // ProjectEmployee (many-to-many link table) - CASCADE DELETE
            modelBuilder.Entity<ProjectEmployee>()
                .HasOne(pe => pe.Project)
                .WithMany(p => p.ProjectEmployees)
                .HasForeignKey(pe => pe.ProjectId)
                .OnDelete(DeleteBehavior.Cascade); // Deleting a project removes all ProjectEmployees
            
            modelBuilder.Entity<ProjectEmployee>()
                .HasOne(pe => pe.Employee)
                .WithMany(u => u.ProjectEmployees)
                .HasForeignKey(pe => pe.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade); // Deleting an employee removes their ProjectEmployee records

            // Session -> Employee (User)
            modelBuilder.Entity<Session>()
                .HasOne(s => s.Employee)
                .WithMany(u => u.Sessions)
                .HasForeignKey(s => s.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade); // Deleting a user deletes their sessions

            // Session -> Project
            modelBuilder.Entity<Session>()
                .HasOne(s => s.Project)
                .WithMany()
                .HasForeignKey(s => s.ProjectId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Cascade); // Deleting a project deletes all related sessions

            // Screenshot -> Session
            modelBuilder.Entity<Screenshot>()
                .HasOne(sc => sc.Session)
                .WithMany(s => s.Screenshots)
                .HasForeignKey(sc => sc.SessionId)
                .OnDelete(DeleteBehavior.Cascade); // Deleting a session deletes all screenshots

            // SessionForegroundApp -> Session
            modelBuilder.Entity<SessionForegroundApp>()
                .HasOne(fg => fg.Session)
                .WithMany(s => s.ForegroundApps)
                .HasForeignKey(fg => fg.SessionId)
                .OnDelete(DeleteBehavior.Cascade); // Deleting a session deletes all foreground apps

            // SessionBackgroundApp -> Session
            modelBuilder.Entity<SessionBackgroundApp>()
                .HasOne(bg => bg.Session)
                .WithMany(s => s.BackgroundApps)
                .HasForeignKey(bg => bg.SessionId)
                .OnDelete(DeleteBehavior.Cascade); // Deleting a session deletes all background apps

            modelBuilder.Entity<AttendanceRecord>()
                .HasOne(a => a.Employee)
                .WithMany()
                .HasForeignKey(a => a.EmployeeId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AttendanceRecord>()
                .HasIndex(a => a.EmployeeId)
                .HasFilter("\"Status\" = 'Active'")
                .IsUnique();

            modelBuilder.Entity<AttendanceIdlePeriod>()
                .HasOne(i => i.AttendanceRecord)
                .WithMany(a => a.IdlePeriods)
                .HasForeignKey(i => i.AttendanceRecordId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Device>()
                .HasOne(d => d.Employee)
                .WithMany()
                .HasForeignKey(d => d.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<SecurityEvent>()
                .HasOne(e => e.Employee).WithMany().HasForeignKey(e => e.EmployeeId).OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<BackupFile>()
                .HasOne(f => f.Employee).WithMany().HasForeignKey(f => f.EmployeeId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<BackupFile>()
                .HasIndex(f => new { f.EmployeeId, f.DeviceId, f.OriginalPath }).IsUnique();
            modelBuilder.Entity<FileVersion>()
                .HasOne(v => v.BackupFile).WithMany(f => f.Versions).HasForeignKey(v => v.BackupFileId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<FileVersion>().HasIndex(v => v.ContentHash);
            modelBuilder.Entity<BackupRestoreRequest>()
                .HasOne(r => r.FileVersion).WithMany(v => v.RestoreRequests).HasForeignKey(r => r.FileVersionId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<BackupRestoreRequest>().HasIndex(r => new { r.EmployeeId, r.DeviceId, r.Status });
            modelBuilder.Entity<BackupInventoryRun>().HasOne(x => x.Employee).WithMany().HasForeignKey(x => x.EmployeeId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<BackupInventoryItem>().HasOne(x => x.Run).WithMany(x => x.Items).HasForeignKey(x => x.RunId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<BackupInventoryItem>().HasIndex(x => new { x.RunId, x.Path }).IsUnique();
            modelBuilder.Entity<BackupPathRule>().HasIndex(x => new { x.DeviceId, x.Path }).IsUnique();
            modelBuilder.Entity<DeviceSecurityPolicy>().HasOne(x => x.Device).WithOne().HasForeignKey<DeviceSecurityPolicy>(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<DeviceSecurityPolicy>().HasIndex(x => x.DeviceId).IsUnique();
            modelBuilder.Entity<AdminAuditLog>().HasIndex(x => x.OccurredAt);
            modelBuilder.Entity<AdminAuditLog>().HasIndex(x => x.Sequence).IsUnique();
            modelBuilder.Entity<StorageDeletionJob>().HasIndex(x => x.ObjectKey).IsUnique();
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                var environment = "Development";

                var config = new ConfigurationBuilder()
                    .SetBasePath(Directory.GetCurrentDirectory())
                    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
                    .AddJsonFile($"appsettings.{environment}.json", optional: true, reloadOnChange: true) // Loads appsettings.Development.json in Development mode
                    .Build();

                var connectionString = config.GetConnectionString("SmDb");

                if (string.IsNullOrEmpty(connectionString))
                {
                    throw new InvalidOperationException("Database connection string is missing. Check your appsettings.Development.json file.");
                }

                optionsBuilder.UseNpgsql(connectionString);
            }
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<ProjectEmployee> ProjectEmployees { get; set; }
        public DbSet<Session> Sessions { get; set; }
        public DbSet<Screenshot> Screenshots { get; set; }
        public DbSet<SessionBackgroundApp> SessionBackgroundApps {  get; set; } 
        public DbSet<SessionForegroundApp> SessionForegroundApps { get; set; }
        public DbSet<AttendanceRecord> AttendanceRecords { get; set; }
        public DbSet<AttendanceIdlePeriod> AttendanceIdlePeriods { get; set; }
        public DbSet<Device> Devices { get; set; }
        public DbSet<SecurityEvent> SecurityEvents { get; set; }
        public DbSet<BackupFile> BackupFiles { get; set; }
        public DbSet<FileVersion> FileVersions { get; set; }
        public DbSet<BackupRestoreRequest> BackupRestoreRequests { get; set; }
        public DbSet<BackupInventoryRun> BackupInventoryRuns { get; set; }
        public DbSet<BackupInventoryItem> BackupInventoryItems { get; set; }
        public DbSet<BackupPathRule> BackupPathRules { get; set; }
        public DbSet<DeviceSecurityPolicy> DeviceSecurityPolicies { get; set; }
        public DbSet<AdminAuditLog> AdminAuditLogs { get; set; }
        public DbSet<StorageDeletionJob> StorageDeletionJobs { get; set; }
    }
}
