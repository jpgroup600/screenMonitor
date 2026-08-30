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
  const risk = value.risk || {};
  const fields = [
    ['USB', [usb.manufacturer, usb.model].filter(present).join(' ')],
    ['Serial', usb.deviceSerialNumber],
    ['Volume', [usb.volumeLabel, usb.fileSystem, usb.volumeSerialNumber].filter(present).join(' / ')],
    ['BitLocker', usb.bitLockerProtectionStatus],
    ['Risk', risk.level],
    ['Risk reasons', Array.isArray(risk.reasons) ? risk.reasons.join(', ') : null],
    ['5m files', present(risk.windowFileCount) ? String(risk.windowFileCount) : null],
    ['5m bytes', present(risk.windowBytes) ? `${Number(risk.windowBytes).toLocaleString()} bytes` : null],
    ['Size', present(value.sizeBytes) ? `${Number(value.sizeBytes).toLocaleString()} bytes` : null],
    ['SHA-256', value.sha256],
    ['Destination', value.destination],
    ['Process', value.processName || (present(value.processId) ? `PID ${value.processId}` : null)],
    ['Channel', value.channel],
    ['Confirmed transfer', typeof value.confirmedFileTransfer === 'boolean' ? String(value.confirmedFileTransfer) : null],
    ['Evidence', value.evidenceError || value.evidence],
  ];
  return fields.filter(([, fieldValue]) => present(fieldValue));
}
