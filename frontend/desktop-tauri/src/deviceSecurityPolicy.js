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
});

export function normalizeDeviceSecurityPolicy(value) {
  return Object.fromEntries(Object.entries(defaultDeviceSecurityPolicy)
    .map(([key, fallback]) => [key, typeof value?.[key] === 'boolean' ? value[key] : fallback]));
}

export async function loadDeviceSecurityPolicy({ request, storage }) {
  const deviceId = storage.getItem('screenMonitorDeviceId');
  if (!deviceId) return defaultDeviceSecurityPolicy;
  return normalizeDeviceSecurityPolicy(await request.get(`/security-policies/device/${deviceId}/effective`));
}

export function sameDeviceSecurityPolicy(left, right) {
  return Object.keys(defaultDeviceSecurityPolicy).every((key) => left?.[key] === right?.[key]);
}
