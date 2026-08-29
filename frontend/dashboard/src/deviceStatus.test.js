import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeviceOnline } from './deviceStatus.js';

test('device is online when heartbeat is within 90 seconds', () => {
  const now = Date.parse('2026-08-30T00:00:00Z');
  assert.equal(isDeviceOnline('2026-08-29T23:58:31Z', now), true);
  assert.equal(isDeviceOnline('2026-08-29T23:58:29Z', now), false);
});

test('invalid heartbeat is offline', () => {
  assert.equal(isDeviceOnline('invalid', Date.now()), false);
});
