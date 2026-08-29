using ScreenshotMonitor.Data.Enum;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static System.Collections.Specialized.BitVector32;

namespace ScreenshotMonitor.Data.Entities
{
    public class User
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required, MaxLength(100)]
        public string FullName { get; set; }

        [Required, EmailAddress]
        public string Email { get; set; }

        [Required]
        public string PasswordHash { get; set; } // Hashed password

        public string Role { get; set; }

        [MaxLength(50)]
        public string Designation { get; set; } // Only for Employees

        [MaxLength(15)]
        public string PhoneNumber { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public TimeSpan TotalOnlineTime { get; set; } // Total online time of employee

        // Relations
        public ICollection<ProjectEmployee> ProjectEmployees { get; set; } = new List<ProjectEmployee>();
        public ICollection<Session> Sessions { get; set; } = new List<Session>();
    }
}
