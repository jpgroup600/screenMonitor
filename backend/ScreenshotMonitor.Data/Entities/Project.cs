using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ScreenshotMonitor.Data.Enum;

namespace ScreenshotMonitor.Data.Entities
{
    public class Project
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();
        [Required, MaxLength(200)]
        public string Name { get; set; }

        [MaxLength(500)]
        public string Description { get; set; }

        public string AdminId { get; set; }

        [ForeignKey("AdminId")]
        public User Admin { get; set; } // The Admin who created the project

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? EndDate { get; set; } // Project completion date

        public String Status { get; set; } // Default: Active

        // Relations
        public ICollection<ProjectEmployee> ProjectEmployees { get; set; } = new List<ProjectEmployee>();
    }
}
