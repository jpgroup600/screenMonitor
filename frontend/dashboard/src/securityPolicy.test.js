import test from 'node:test';
import assert from 'node:assert/strict';
import { securityPolicyModules, securityPolicyPayload, updateSecurityPolicy } from './securityPolicy.js';

test('every independently controlled security module is represented', () => {
  assert.deepEqual(securityPolicyModules.map(([key]) => key), [
    'monitoringEnabled', 'screenshotsEnabled', 'activeAppTrackingEnabled', 'idleTrackingEnabled',
    'backupEnabled', 'usbAuditEnabled', 'usbFileCopyAuditEnabled', 'usbRiskDetectionEnabled', 'networkAuditEnabled', 'fileChangeAuditEnabled',
    'attendanceRemindersEnabled', 'restoreEnabled', 'retentionEnabled', 'resourceThrottlingEnabled', 'pauseBackupOnBattery',
    'pauseBackupOnMeteredNetwork',
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
    scanThrottleMilliseconds: 15, dailyUploadLimitBytes: 5 * 1024 ** 3,
  });
  assert.equal(Object.keys(payload).length, 21);
  assert.equal(payload.deviceId, undefined);
  assert.equal(payload.retentionDays, 30);
  assert.equal(payload.maxBackupBytes, 5 * 1024 ** 3);
  assert.equal(payload.maxVersionsPerFile, 12);
  assert.equal(payload.scanThrottleMilliseconds, 15);
  assert.equal(payload.dailyUploadLimitBytes, 5 * 1024 ** 3);
  assert.ok(securityPolicyModules.every(([key]) => typeof payload[key] === 'boolean'));
});

test('invalid retention and resource values fall back to safe defaults', () => {
  const payload = securityPolicyPayload({ retentionDays: 0, maxBackupBytes: -1, maxVersionsPerFile: 5000, scanThrottleMilliseconds: 1001, dailyUploadLimitBytes: 0 });
  assert.equal(payload.retentionDays, 90);
  assert.equal(payload.maxBackupBytes, 50 * 1024 ** 3);
  assert.equal(payload.maxVersionsPerFile, 20);
  assert.equal(payload.scanThrottleMilliseconds, 2);
  assert.equal(payload.dailyUploadLimitBytes, 10 * 1024 ** 3);
});
