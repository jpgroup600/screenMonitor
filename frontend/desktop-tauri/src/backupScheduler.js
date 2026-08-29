export const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const BACKUP_INITIAL_DELAY_MS = 60 * 1000;

export async function runBackupCycle({ native, storage }) {
  const token = storage.getItem("token");
  const deviceId = storage.getItem("screenMonitorDeviceId");
  if (!token || !deviceId) return null;
  const roots = await native.listFixedDrives();
  if (!roots?.length) return null;
  return native.runIncrementalBackup(token, deviceId, roots);
}
