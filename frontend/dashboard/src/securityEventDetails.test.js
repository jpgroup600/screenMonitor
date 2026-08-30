import test from 'node:test';
import assert from 'node:assert/strict';
import { securityEventDetailRows } from './securityEventDetails.js';

test('formats USB identity, BitLocker and file hash evidence', () => {
  const rows = securityEventDetailRows(JSON.stringify({
    sizeBytes: 42,
    sha256: 'a'.repeat(64),
    risk: { level: 'High', reasons: ['archive_file', 'bulk_write_window'], windowFileCount: 50, windowBytes: 1024 },
    usbDevice: {
      manufacturer: 'Vendor', model: 'Secure USB', deviceSerialNumber: 'SERIAL-1',
      volumeLabel: 'WORK', fileSystem: 'NTFS', volumeSerialNumber: 'A1B2',
      bitLockerProtectionStatus: 'On',
    },
  }));
  assert.deepEqual(rows.slice(0, 6), [
    ['USB', 'Vendor Secure USB'],
    ['Serial', 'SERIAL-1'],
    ['Volume', 'WORK / NTFS / A1B2'],
    ['BitLocker', 'On'],
    ['Risk', 'High'],
    ['Risk reasons', 'archive_file, bulk_write_window'],
  ]);
  assert.deepEqual(rows[6], ['5m files', '50']);
  assert.deepEqual(rows[7], ['5m bytes', '1,024 bytes']);
  assert.deepEqual(rows[8], ['Size', '42 bytes']);
  assert.deepEqual(rows[9], ['SHA-256', 'a'.repeat(64)]);
});

test('ignores malformed legacy details without breaking the event list', () => {
  assert.deepEqual(securityEventDetailRows('not-json'), []);
});
