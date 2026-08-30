const DEVICE_ID_KEY = "screenMonitorDeviceId";

export function getOrCreateDeviceId(storage, createId) {
  const existing = storage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = createId();
  storage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export async function sendDeviceHeartbeat({ request, storage, native, createId = () => crypto.randomUUID(), platform = defaultPlatform }) {
  const deviceId = getOrCreateDeviceId(storage, createId);
  const agent = await native?.agentStatus?.().catch(() => null);
  const environment = platform();
  return request.post("/devices/heartbeat", {
    deviceId,
    name: environment.name,
    operatingSystem: environment.operatingSystem,
    agentVersion: agent?.agentVersion || "unknown",
    agentMode: agent?.agentMode || "UserSession",
    monitoringState: agent?.monitoringState || "Starting",
    pendingQueueItems: agent?.pendingQueueItems || 0,
  });
}

function defaultPlatform() {
  return {
    name: navigator.userAgentData?.platform || navigator.platform || "Windows PC",
    operatingSystem: navigator.userAgent,
  };
}

export async function restoreAuthorizedMonitoring({ heartbeat, restore }) {
  await heartbeat();
  return restore();
}
