using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ScreenshotMonitor.Data.Dto.Project;
using ScreenshotMonitor.Data.Entities;

namespace ScreenshotMonitor.Data.Interfaces.Repositories
{
    
    public interface IAdminRepository
    {
        Task<UserDetailesDto.UserProjectAppSummaryDto> GetUserWithProjectsAndTopAppsAsync(string userId);
        Task<bool> ResetUserPasswordAsync(string adminId, string userId, string newPassword);
        Task<bool> ChangeOwnPasswordAsync(string userId, string oldPassword, string newPassword);
        Task<bool> EditUserProfileAsync(string userId, UpdateUserProfileDto updateDto);
        Task<List<User>> GetAllUsersAsync();
        Task<List<User>> GetAdminsOnlyAsync();
        Task<List<User>> GetEmployeesOnlyAsync();
        Task<User?> GetUserByIdAsync(string userId);
        Task<List<User>> UpdateTotalOnlineTimeAndGetAllEmployeesAsync();
        Task<bool> DeleteUserAsync(Guid userId);
    }

}
