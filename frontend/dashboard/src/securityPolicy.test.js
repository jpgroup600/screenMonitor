import test from 'node:test';
import assert from 'node:assert/strict';
import { securityPolicyModules, securityPolicyPayload, updateSecurityPolicy } from './securityPolicy.js';

test('every independently controlled security module is represented', () => {
  assert.deepEqual(securityPolicyModules.map(([key]) => key), [
    'monitoringEnabled', 'screenshotsEnabled', 'activeAppTrackingEnabled', 'idleTrackingEnabled',
    'backupEnabled', 'usbAuditEnabled', 'usbFileCopyAuditEnabled', 'networkAuditEnabled', 'fileChangeAuditEnabled',
    'attendanceRemindersEnabled', 'restoreEnabled', 'retentionEnabled',
  ]);
});

test('one module can be toggled without changing the others', () => {
  const original = { monitoringEnabled: true, backupEnabled: true };
  const changed = updateSecurityPolicy(original, 'backupEnabled', false);
  assert.deepEqual(changed, { monitoringEnabled: true, backupEnabled: false });
  assert.equal(original.backupEnabled, true);
});

test('API payload contains module switches and bounded retention settings', () => {
  const payload = securityPolicyPayload({
    ...Object.fromEntries(securityPolicyModules.map(([key]) => [key, true])),
    deviceId: 'device-1', updatedByAdminId: 'admin-1',
    retentionDays: 30, maxBackupBytes: 5 * 1024 ** 3, maxVersionsPerFile: 12,
  });
  assert.equal(Object.keys(payload).length, 15);
  assert.equal(payload.deviceId, undefined);
  assert.equal(payload.retentionDays, 30);
  assert.equal(payload.maxBackupBytes, 5 * 1024 ** 3);
  assert.equal(payload.maxVersionsPerFile, 12);
  assert.ok(securityPolicyModules.every(([key]) => typeof payload[key] === 'boolean'));
});

test('invalid retention values fall back to safe defaults', () => {
  const payload = securityPolicyPayload({ retentionDays: 0, maxBackupBytes: -1, maxVersionsPerFile: 5000 });
  assert.equal(payload.retentionDays, 90);
  assert.equal(payload.maxBackupBytes, 50 * 1024 ** 3);
  assert.equal(payload.maxVersionsPerFile, 20);
});
