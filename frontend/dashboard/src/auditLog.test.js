import test from 'node:test';
import assert from 'node:assert/strict';
import { auditActionLabel, changedPolicyKeys } from './auditLog.js';

test('audit actions have administrator friendly labels', () => {
  assert.equal(auditActionLabel('DEVICE_SECURITY_POLICY_UPDATED'), '장치 보안 정책 변경');
  assert.equal(auditActionLabel('BACKUP_DETAIL_VIEWED'), '백업 상세 조회');
  assert.equal(auditActionLabel('BACKUP_RESTORE_REQUESTED'), '백업 복원 요청');
});

test('changed policy keys are derived from immutable before and after snapshots', () => {
  assert.deepEqual(changedPolicyKeys('{"backupEnabled":true,"usbAuditEnabled":true}', '{"backupEnabled":false,"usbAuditEnabled":true}'), ['backupEnabled']);
  assert.deepEqual(changedPolicyKeys('invalid', '{}'), []);
});
