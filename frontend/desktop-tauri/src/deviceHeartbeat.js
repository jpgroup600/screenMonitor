const DEVICE_ID_KEY = "screenMonitorDeviceId";

export function getOrCreateDeviceId(storage, createId) {
  const existing = storage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = createId();
  storage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export async function sendDeviceHeartbeat({ request, storage, createId = () => crypto.randomUUID() }) {
  const deviceId = getOrCreateDeviceId(storage, createId);
  return request.post("/devices/heartbeat", {
    deviceId,
    name: navigator.userAgentData?.platform || navigator.platform || "Windows PC",
    operatingSystem: navigator.userAgent,
  });
}

export async function restoreAuthorizedMonitoring({ heartbeat, restore }) {
  await heartbeat();
  return restore();
}
