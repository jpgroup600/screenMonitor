using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ScreenshotMonitor.Data.Entities
{
    public class Session
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        public string EmployeeId { get; set; }
        [ForeignKey("EmployeeId")]
        public User Employee { get; set; }

        public string ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project Project { get; set; }

        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }

        public TimeSpan ActiveDuration { get; set; }
        // New Status property to classify sessions
        public string Status { get; set; } = "Active";
        // Relations
        public ICollection<Screenshot> Screenshots { get; set; } = new List<Screenshot>();
        public ICollection<SessionForegroundApp> ForegroundApps { get; set; } = new List<SessionForegroundApp>();
        public ICollection<SessionBackgroundApp> BackgroundApps { get; set; } = new List<SessionBackgroundApp>();
    }

}
