import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveFolderRule, folderDisplayName, normalizeFolderSearch } from './folderPolicy.js';

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
  assert.equal(effectiveFolderRule('D:\\Company', rules).action, 'Include');
});
