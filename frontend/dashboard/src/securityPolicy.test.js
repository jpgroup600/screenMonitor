import test from 'node:test';
import assert from 'node:assert/strict';
import { securityPolicyModules, securityPolicyPayload, updateSecurityPolicy } from './securityPolicy.js';

test('every independently controlled security module is represented', () => {
  assert.deepEqual(securityPolicyModules.map(([key]) => key), [
    'monitoringEnabled', 'screenshotsEnabled', 'activeAppTrackingEnabled', 'idleTrackingEnabled',
    'backupEnabled', 'usbAuditEnabled', 'networkAuditEnabled', 'fileChangeAuditEnabled',
    'attendanceRemindersEnabled', 'restoreEnabled',
  ]);
});

test('one module can be toggled without changing the others', () => {
  const original = { monitoringEnabled: true, backupEnabled: true };
  const changed = updateSecurityPolicy(original, 'backupEnabled', false);
  assert.deepEqual(changed, { monitoringEnabled: true, backupEnabled: false });
  assert.equal(original.backupEnabled, true);
});

test('API payload contains booleans only and excludes server metadata', () => {
  const payload = securityPolicyPayload({
    ...Object.fromEntries(securityPolicyModules.map(([key]) => [key, true])),
    deviceId: 'device-1', updatedByAdminId: 'admin-1',
  });
  assert.equal(Object.keys(payload).length, 10);
  assert.equal(payload.deviceId, undefined);
  assert.ok(Object.values(payload).every((value) => typeof value === 'boolean'));
});
