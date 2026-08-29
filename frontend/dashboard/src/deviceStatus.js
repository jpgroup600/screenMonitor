export const DEVICE_ONLINE_WINDOW_MS = 90_000;

export function isDeviceOnline(lastSeenAt, now = Date.now()) {
  const lastSeen = new Date(lastSeenAt).getTime();
  return Number.isFinite(lastSeen) && now - lastSeen <= DEVICE_ONLINE_WINDOW_MS;
}
