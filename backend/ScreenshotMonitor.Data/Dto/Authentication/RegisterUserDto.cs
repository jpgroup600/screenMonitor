using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ScreenshotMonitor.Data.Dto.Authentication
{
    public class RegisterUserDto
    {
        [Required, MaxLength(100)]
        public required string FullName { get; set; }

        [Required, EmailAddress]
        public required string Email { get; set; }

        [Required, MinLength(6)]
        public required string Password { get; set; } // Plaintext password (hashed later)

        [MaxLength(50)]
        public string? Designation { get; set; } // Only for Employees

        [MaxLength(15), Phone]
        public required string PhoneNumber { get; set; }
    }

}
