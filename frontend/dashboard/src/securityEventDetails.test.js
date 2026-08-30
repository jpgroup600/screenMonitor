import test from 'node:test';
import assert from 'node:assert/strict';
import { securityEventDetailRows } from './securityEventDetails.js';

test('formats USB identity, BitLocker and file hash evidence', () => {
  const rows = securityEventDetailRows(JSON.stringify({
    sizeBytes: 42,
    sha256: 'a'.repeat(64),
    usbDevice: {
      manufacturer: 'Vendor', model: 'Secure USB', deviceSerialNumber: 'SERIAL-1',
      volumeLabel: 'WORK', fileSystem: 'NTFS', volumeSerialNumber: 'A1B2',
      bitLockerProtectionStatus: 'On',
    },
  }));
  assert.deepEqual(rows.slice(0, 5), [
    ['USB', 'Vendor Secure USB'],
    ['Serial', 'SERIAL-1'],
    ['Volume', 'WORK / NTFS / A1B2'],
    ['BitLocker', 'On'],
    ['Size', '42 bytes'],
  ]);
  assert.deepEqual(rows[5], ['SHA-256', 'a'.repeat(64)]);
});

test('ignores malformed legacy details without breaking the event list', () => {
  assert.deepEqual(securityEventDetailRows('not-json'), []);
});
