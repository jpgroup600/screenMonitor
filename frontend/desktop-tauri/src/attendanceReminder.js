export const ATTENDANCE_REMINDER_INTERVAL_MS = 10 * 60 * 1000;

export function startAttendanceReminder(notify, intervalMs = ATTENDANCE_REMINDER_INTERVAL_MS) {
  const timer = globalThis.setInterval(() => {
    Promise.resolve(notify()).catch((error) => {
      console.error("Failed to show attendance reminder:", error);
    });
  }, intervalMs);

  return () => globalThis.clearInterval(timer);
}
