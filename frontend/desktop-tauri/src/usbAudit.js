export function diffRemovableDrives(previous, current) {
  const before = new Set(previous);
  const after = new Set(current);
  return {
    connected: current.filter((drive) => !before.has(drive)),
    disconnected: previous.filter((drive) => !after.has(drive)),
  };
}

export async function recordUsbChanges({ request, deviceId, changes }) {
  const events = [
    ...changes.connected.map((source) => ({ eventType: 'USB_CONNECTED', source })),
    ...changes.disconnected.map((source) => ({ eventType: 'USB_DISCONNECTED', source })),
  ];
  await Promise.all(events.map((event) => request.post('/security-events', { deviceId, ...event, details: '{}' })));
}
