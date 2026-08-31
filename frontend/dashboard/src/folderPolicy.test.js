import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveFolderRule, folderDisplayName, normalizeFolderSearch, splitExplicitRules } from './folderPolicy.js';

test('localized known-folder searches use the physical Windows path name', () => {
  assert.equal(normalizeFolderSearch('바탕화면'), 'Desktop');
  assert.equal(normalizeFolderSearch('문서'), 'Documents');
  assert.equal(folderDisplayName({ name: 'Desktop' }), '바탕화면');
});

test('the most specific folder policy wins and reports inheritance', () => {
  const rules = [
    { path: 'C:\\Users\\ASUS', action: 'Exclude' },
    { path: 'C:\\Users\\ASUS\\Documents', action: 'Include' },
  ];
  assert.deepEqual(effectiveFolderRule('C:\\Users\\ASUS\\Documents', rules), { action: 'Include', inherited: false, source: 'C:\\Users\\ASUS\\Documents' });
  assert.deepEqual(effectiveFolderRule('C:\\Users\\ASUS\\Documents\\Work', rules), { action: 'Include', inherited: true, source: 'C:\\Users\\ASUS\\Documents' });
  assert.equal(effectiveFolderRule('D:\\Company', rules).action, 'Exclude');
});

test('explicit include and exclude lists are separated newest first', () => {
  const lists = splitExplicitRules([
    { path: 'C:\\Old', action: 'Include', createdAt: '2026-08-30T00:00:00Z' },
    { path: 'C:\\Blocked', action: 'Exclude', createdAt: '2026-08-31T00:00:00Z' },
    { path: 'C:\\New', action: 'Include', createdAt: '2026-09-01T00:00:00Z' },
  ]);
  assert.deepEqual(lists.included.map((rule) => rule.path), ['C:\\New', 'C:\\Old']);
  assert.deepEqual(lists.excluded.map((rule) => rule.path), ['C:\\Blocked']);
});
