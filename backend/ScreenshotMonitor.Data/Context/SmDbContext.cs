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
    }
}
