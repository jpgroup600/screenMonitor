import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, newestVersionsFirst, restoreRequestPayload } from './backupFile.js';

test('formatBytes formats backup sizes for administrators', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2 MB');
});

test('restore request targets one exact backup version', () => {
  assert.deepEqual(restoreRequestPayload('version-1'), { fileVersionId: 'version-1' });
  assert.throws(() => restoreRequestPayload(''), /required/);
});

test('newestVersionsFirst sorts without mutating API data', () => {
  const versions = [
    { id: 'old', uploadedAt: '2026-08-29T01:00:00Z' },
    { id: 'new', uploadedAt: '2026-08-30T01:00:00Z' },
  ];
  assert.deepEqual(newestVersionsFirst(versions).map((item) => item.id), ['new', 'old']);
  assert.deepEqual(versions.map((item) => item.id), ['old', 'new']);
});
