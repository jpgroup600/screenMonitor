export const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const BACKUP_INITIAL_DELAY_MS = 60 * 1000;

export async function runBackupCycle({ native, storage, policy }) {
  const token = await native.loadAuthToken();
  const deviceId = storage.getItem("screenMonitorDeviceId");
  if (!token || !deviceId) return null;
  const roots = await native.listFixedDrives();
  if (!roots?.length) return null;
  const throttle = policy?.resourceThrottlingEnabled ? Number(policy?.scanThrottleMilliseconds || 0) : 0;
  return native.runIncrementalBackup(token, deviceId, roots, Boolean(policy?.fileChangeAuditEnabled), throttle);
}

export async function runBackupQueueCycle({ native, storage, policy }) {
  const token = await native.loadAuthToken();
  const deviceId = storage.getItem("screenMonitorDeviceId");
  if (!token || !deviceId) return null;
  return native.processInventoryBackup(token, deviceId, {
    resourceThrottlingEnabled: Boolean(policy?.resourceThrottlingEnabled),
    pauseBackupOnBattery: Boolean(policy?.pauseBackupOnBattery),
    dailyUploadLimitBytes: Number(policy?.dailyUploadLimitBytes || 10 * 1024 ** 3),
  });
}
