using ScreenshotMonitor.Data.Dto.Authentication;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ScreenshotMonitor.Data.Entities.Mapper
{
    public static class UserMapper
    {
        public static User ToUserEntity(this RegisterUserDto dto, string role)
        {
            return new User
            {
                FullName = dto.FullName,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password), // Hash password
                Role = role, // Role should be set manually based on the function
                Designation = dto.Designation,
                //Designation = role == "Employee" ? dto.Designation : "Admin", // Only for Employees
                PhoneNumber = dto.PhoneNumber,
                CreatedAt = DateTime.UtcNow,
                TotalOnlineTime = TimeSpan.Zero // Default value
            };
        }
    }

}
