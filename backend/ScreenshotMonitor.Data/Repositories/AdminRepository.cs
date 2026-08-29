using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Interfaces.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ScreenshotMonitor.Data.Dto.Project;

namespace ScreenshotMonitor.Data.Repositories
{

    public class AdminRepository(
        IConfiguration conf,
        SmDbContext dbContext,
        ILogger<AdminRepository> logger
    ) : IAdminRepository
    {
        public async Task<UserDetailesDto.UserProjectAppSummaryDto> GetUserWithProjectsAndTopAppsAsync(string userId)
        {
            try
            {
                var user = await dbContext.Users
                    .Where(u => u.Id == userId)
                    .Select(u => new UserDetailesDto.UserProjectAppSummaryDto
                    {
                        UserId = u.Id,
                        FullName = u.FullName,
                        Email = u.Email,
                        Role = u.Role,
                        Designation = u.Designation,
                        PhoneNumber = u.PhoneNumber,
                        CreatedAt = u.CreatedAt,
                        TotalOnlineTime = u.TotalOnlineTime,
                        Projects = u.ProjectEmployees
                            .Select(pe => new UserDetailesDto.ProjectInfoDto
                            {
                                ProjectId = pe.Project.Id,
                                ProjectName = pe.Project.Name
                            }).ToList()
                    })
                    .FirstOrDefaultAsync();

                if (user == null)
                {
                    logger.LogWarning("User with ID {UserId} not found", userId);
                    return null;
                }

                // Fetch Top 5 Used Apps Separately
                var topAppsRaw = await dbContext.SessionForegroundApps
                    .Where(sfa => sfa.Session.EmployeeId == userId)
                    .Select(sfa => new 
                    {
                        sfa.AppName,
                        TotalUsageTicks = (long?)sfa.TotalUsageTime.Ticks ?? 0
                    })
                    .ToListAsync(); // Fetch data first

// Perform GroupBy in-memory
                var topApps = topAppsRaw
                    .GroupBy(sfa => sfa.AppName)
                    .Select(g => new UserDetailesDto.AppUsageDto2
                    {
                        AppName = g.Key,
                        TotalUsageTime = TimeSpan.FromTicks(g.Sum(s => s.TotalUsageTicks))
                    })
                    .OrderByDescending(a => a.TotalUsageTime)
                    .Take(5)
                    .ToList();


                user.TopApps = topApps ?? new List<UserDetailesDto.AppUsageDto2>();


                return user;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error fetching user data for UserId {UserId}", userId);
                throw;
            }
        }


        public async Task<bool> ResetUserPasswordAsync(string adminId, string userId, string newPassword)
        {
            try
            {
                var adminUser = await dbContext.Users.FindAsync(adminId);
                if (adminUser == null || adminUser.Role != "Admin")
                {
                    logger.LogWarning("Unauthorized password reset attempt by UserId {AdminId}", adminId);
                    return false;
                }

                var user = await dbContext.Users.FindAsync(userId);
                if (user == null)
                {
                    logger.LogWarning("User with ID {UserId} not found", userId);
                    return false;
                }

                // Update password
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);

                dbContext.Users.Update(user);
                await dbContext.SaveChangesAsync();

                logger.LogInformation("Password reset successfully by Admin {AdminId} for User {UserId}", adminId, userId);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error resetting password for UserId {UserId}", userId);
                return false;
            }
        }

        public async Task<bool> ChangeOwnPasswordAsync(string userId, string oldPassword, string newPassword)
        {
            try
            {
                var user = await dbContext.Users.FindAsync(userId);
                if (user == null)
                {
                    logger.LogWarning("User with ID {UserId} not found", userId);
                    return false;
                }

                // Verify old password
                if (!BCrypt.Net.BCrypt.Verify(oldPassword, user.PasswordHash))
                {
                    logger.LogWarning("Incorrect old password for UserId {UserId}", userId);
                    return false;
                }

                // Update password
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);

                dbContext.Users.Update(user);
                await dbContext.SaveChangesAsync();

                logger.LogInformation("Password updated successfully for UserId {UserId}", userId);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error updating password for UserId {UserId}", userId);
                return false;
            }
        }

        public async Task<bool> EditUserProfileAsync(string userId, UpdateUserProfileDto updateDto)
        {
            try
            {
                var user = await dbContext.Users.FindAsync(userId);
                if (user == null)
                {
                    logger.LogWarning("User with ID {UserId} not found", userId);
                    return false;
                }

                bool isUpdated = false;

                // Update only provided fields
                if (updateDto.FullName is not null)
                {
                    user.FullName = updateDto.FullName;
                    isUpdated = true;
                }

                if (updateDto.Email is not null)
                {
                    user.Email = updateDto.Email;
                    isUpdated = true;
                }

                if (updateDto.Designation is not null)
                {
                    user.Designation = updateDto.Designation;
                    isUpdated = true;
                }

                if (updateDto.PhoneNumber is not null)
                {
                    user.PhoneNumber = updateDto.PhoneNumber;
                    isUpdated = true;
                }

                if (updateDto.Role is not null)
                {
                    user.Role = updateDto.Role;
                    isUpdated = true;
                }

                // Ensure at least one value is updated
                if (!isUpdated)
                {
                    logger.LogWarning("No valid updates provided for UserId {UserId}", userId);
                    return false;
                }

                dbContext.Users.Update(user);
                await dbContext.SaveChangesAsync();

                logger.LogInformation("Profile updated successfully for UserId {UserId}", userId);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error updating profile for UserId {UserId}", userId);
                return false;
            }
        }


        private bool IsValidEmail(string email)
        {
            try
            {
                var addr = new System.Net.Mail.MailAddress(email);
                return addr.Address == email;
            }
            catch
            {
                return false;
            }
        }

        // Fetch all users
        public async Task<List<User>> GetAllUsersAsync()
        {
            try
            {
                return await dbContext.Users.ToListAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error fetching all users");
                throw;
            }
        }

        // Fetch only Admins
        public async Task<List<User>> GetAdminsOnlyAsync()
        {
            try
            {
                return await dbContext.Users
                    .Where(u => u.Role == "Admin")
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error fetching admins");
                throw;
            }
        }

        // Fetch only Employees
        public async Task<List<User>> GetEmployeesOnlyAsync()
        {
            try
            {
                return await dbContext.Users
                    .Where(u => u.Role == "Employee")
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error fetching employees");
                throw;
            }
        }
        public async Task<List<User>> UpdateTotalOnlineTimeAndGetAllEmployeesAsync()
        {
            try
            {
                // Get all employees with their sessions
                var employees = await dbContext.Users
                    .Include(u => u.Sessions)
                    .Where(u => u.Role == "Employee")
                    .ToListAsync();

                // Loop through each employee and calculate TotalOnlineTime
                foreach (var employee in employees)
                {
                    // Sum ActiveDuration of all sessions for this employee
                    var totalActiveDuration = employee.Sessions
                        .Where(s => s.ActiveDuration != null)
                        .Select(s => s.ActiveDuration)
                        .Aggregate(TimeSpan.Zero, (acc, duration) => acc.Add(duration));

                    // Update TotalOnlineTime
                    employee.TotalOnlineTime = totalActiveDuration;
                }

                // Save changes to DB
                await dbContext.SaveChangesAsync();

                // Return updated list of employee profiles
                return employees;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error updating TotalOnlineTime for all employees");
                throw;
            }
        }

        // Fetch a single user by ID
        public async Task<User?> GetUserByIdAsync(string userId)
        {
            try
            {
                return await dbContext.Users.FindAsync(userId);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error fetching user by ID");
                throw;
            }
        }

        // Delete a user (Admin or Employee)
        public async Task<bool> DeleteUserAsync(Guid userId)
        {
            try
            {
                var user = await dbContext.Users.FindAsync(userId);
                if (user == null)
                    return false;

                dbContext.Users.Remove(user);
                await dbContext.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deleting user");
                throw;
            }
        }
    }

}
