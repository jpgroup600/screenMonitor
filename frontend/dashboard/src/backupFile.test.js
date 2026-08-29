import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, newestVersionsFirst } from './backupFile.js';

test('formatBytes formats backup sizes for administrators', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2 MB');
});

test('newestVersionsFirst sorts without mutating API data', () => {
  const versions = [
    { id: 'old', uploadedAt: '2026-08-29T01:00:00Z' },
    { id: 'new', uploadedAt: '2026-08-30T01:00:00Z' },
  ];
  assert.deepEqual(newestVersionsFirst(versions).map((item) => item.id), ['new', 'old']);
  assert.deepEqual(versions.map((item) => item.id), ['old', 'new']);
});
