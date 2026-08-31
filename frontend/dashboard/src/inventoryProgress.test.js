import test from 'node:test';
import assert from 'node:assert/strict';
import { canStartInventoryBackup, inventoryBackupButtonLabel, inventoryBackupPercent, inventoryHeartbeat } from './inventoryProgress.js';

test('backup can start before inventory scan completes', () => {
  assert.equal(canStartInventoryBackup({ status: 'Scanning', backupRequested: false }), true);
  assert.equal(canStartInventoryBackup({ status: 'Scanning', backupRequested: true }), true);
  assert.equal(canStartInventoryBackup({ status: 'Completed', backupRequested: true }), true);
  assert.equal(inventoryBackupButtonLabel({ status: 'Scanning', backupRequested: false }), '발견 파일 백업 시작');
});

test('backup percentage uses only files eligible for upload', () => {
  assert.equal(inventoryBackupPercent({ pending: 75, backedUp: 25, failed: 0, unchanged: 10 }), 25);
  assert.equal(inventoryBackupPercent({ pending: 0, backedUp: 0, failed: 0 }), 0);
});

test('heartbeat distinguishes healthy delayed and unresponsive scans', () => {
  const now = Date.parse('2026-08-31T00:10:00Z');
  assert.equal(inventoryHeartbeat('2026-08-31T00:09:30Z', now).label, '정상');
  assert.equal(inventoryHeartbeat('2026-08-31T00:07:00Z', now).label, '지연');
  assert.equal(inventoryHeartbeat('2026-08-31T00:00:00Z', now).label, '응답 없음');
});
