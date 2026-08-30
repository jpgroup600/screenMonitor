function parseDetails(details) {
  if (!details) return {};
  if (typeof details === 'object') return details;
  try { return JSON.parse(details); }
  catch { return {}; }
}

function present(value) {
  return value !== null && value !== undefined && value !== '';
}

export function securityEventDetailRows(details) {
  const value = parseDetails(details);
  const usb = value.usbDevice || {};
  const fields = [
    ['USB', [usb.manufacturer, usb.model].filter(present).join(' ')],
    ['Serial', usb.deviceSerialNumber],
    ['Volume', [usb.volumeLabel, usb.fileSystem, usb.volumeSerialNumber].filter(present).join(' / ')],
    ['BitLocker', usb.bitLockerProtectionStatus],
    ['Size', present(value.sizeBytes) ? `${Number(value.sizeBytes).toLocaleString()} bytes` : null],
    ['SHA-256', value.sha256],
    ['Destination', value.destination],
    ['Evidence', value.evidenceError || value.evidence],
  ];
  return fields.filter(([, fieldValue]) => present(fieldValue));
}
