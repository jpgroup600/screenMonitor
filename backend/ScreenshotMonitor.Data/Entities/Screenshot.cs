using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ScreenshotMonitor.Data.Entities
{
    public class Screenshot
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        public string SessionId { get; set; }
        [ForeignKey("SessionId")]
        public Session Session { get; set; }

        [Required]
        public string FilePath { get; set; } // Local File Path (e.g., "C:\Screenshots\user1\ss_2025_01_29.png")

        public DateTime CapturedAt { get; set; } = DateTime.UtcNow;
    }
}
