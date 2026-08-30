import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectedInventoryItems,
  toggleAllInventorySelection,
  toggleInventorySelection,
} from './inventorySelection.js';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('an administrator can select and deselect an inventory item', () => {
  const selected = toggleInventorySelection(new Set(), 'b', true);
  assert.deepEqual([...selected], ['b']);
  assert.deepEqual([...toggleInventorySelection(selected, 'b', false)], []);
});

test('select all affects every currently visible inventory item', () => {
  const selected = toggleAllInventorySelection(new Set(['outside']), items, true);
  assert.deepEqual([...selected], ['outside', 'a', 'b', 'c']);

  const cleared = toggleAllInventorySelection(selected, items, false);
  assert.deepEqual([...cleared], ['outside']);
});

test('bulk actions only use selected items from the current result', () => {
  const selected = new Set(['outside', 'a', 'c']);
  assert.deepEqual(selectedInventoryItems(selected, items).map((item) => item.id), ['a', 'c']);
});
