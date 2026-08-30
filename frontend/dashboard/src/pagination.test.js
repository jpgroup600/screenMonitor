import test from 'node:test';
import assert from 'node:assert/strict';
import { canMoveToNextPage, pageQuery } from './pagination.js';

test('inventory pages translate into bounded server offsets', () => {
  assert.deepEqual(pageQuery(0), { skip: 0, take: 100 });
  assert.deepEqual(pageQuery(3), { skip: 300, take: 100 });
  assert.deepEqual(pageQuery(-1), { skip: 0, take: 100 });
});

test('next page is available only when the current page is full', () => {
  assert.equal(canMoveToNextPage(Array(100)), true);
  assert.equal(canMoveToNextPage(Array(99)), false);
});
