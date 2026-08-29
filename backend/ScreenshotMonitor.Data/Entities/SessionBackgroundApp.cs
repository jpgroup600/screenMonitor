using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ScreenshotMonitor.Data.Entities
{
    

    public class SessionBackgroundApp
    {
        [Key] 
        public string Id { get; set; } = Guid.NewGuid().ToString();

        public string SessionId { get; set; }
        [ForeignKey("SessionId")]
        public Session Session { get; set; }

        [Required]
        public string AppName { get; set; }

        // New Attributes
        public string Status { get; set; } // Active, Inactive, etc.
        public DateTime StartTime { get; set; } // When the app was first detected
        public DateTime? EndTime { get; set; } // When the app was last detected
        public TimeSpan TotalUsageTime { get; set; } 
    }

}
