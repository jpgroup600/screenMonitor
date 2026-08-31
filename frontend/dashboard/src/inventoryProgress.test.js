import test from 'node:test';
import assert from 'node:assert/strict';
import { canConfirmInventoryPlan, canStartInventoryBackup, inventoryBackupButtonLabel, inventoryBackupPercent, inventoryHeartbeat } from './inventoryProgress.js';

test('policy confirmation and backup start are separate states', () => {
  assert.equal(canConfirmInventoryPlan({ status: 'PolicyDraft' }), true);
  assert.equal(canStartInventoryBackup({ status: 'PolicyDraft' }), false);
  assert.equal(canConfirmInventoryPlan({ status: 'PlanReady' }), false);
  assert.equal(canStartInventoryBackup({ status: 'PlanReady' }), true);
  assert.equal(inventoryBackupButtonLabel({ status: 'Scanning' }), '스캔 완료 후 사용 가능');
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
