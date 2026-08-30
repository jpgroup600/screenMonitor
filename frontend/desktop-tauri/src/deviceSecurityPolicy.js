export const defaultDeviceSecurityPolicy = Object.freeze({
  monitoringEnabled: true,
  screenshotsEnabled: true,
  activeAppTrackingEnabled: true,
  idleTrackingEnabled: true,
  backupEnabled: true,
  usbAuditEnabled: true,
  usbFileCopyAuditEnabled: true,
  networkAuditEnabled: true,
  fileChangeAuditEnabled: true,
  attendanceRemindersEnabled: true,
  restoreEnabled: true,
  resourceThrottlingEnabled: true,
  pauseBackupOnBattery: true,
  scanThrottleMilliseconds: 2,
  dailyUploadLimitBytes: 10 * 1024 ** 3,
});

export function normalizeDeviceSecurityPolicy(value) {
  return Object.fromEntries(Object.entries(defaultDeviceSecurityPolicy)
    .map(([key, fallback]) => [key, typeof fallback === 'boolean'
      ? (typeof value?.[key] === 'boolean' ? value[key] : fallback)
      : validNumber(key, value?.[key]) ? value[key] : fallback]));
}

function validNumber(key, value) {
  const limits = { scanThrottleMilliseconds: [0, 1000], dailyUploadLimitBytes: [1024 * 1024, 10 * 1024 ** 4] };
  const [minimum, maximum] = limits[key] || [0, Number.MAX_SAFE_INTEGER];
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export async function loadDeviceSecurityPolicy({ request, storage }) {
  const deviceId = storage.getItem('screenMonitorDeviceId');
  if (!deviceId) return defaultDeviceSecurityPolicy;
  return normalizeDeviceSecurityPolicy(await request.get(`/security-policies/device/${deviceId}/effective`));
}

export function sameDeviceSecurityPolicy(left, right) {
  return Object.keys(defaultDeviceSecurityPolicy).every((key) => left?.[key] === right?.[key]);
}
