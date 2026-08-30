export function toggleInventorySelection(selectedIds, itemId, checked) {
  const next = new Set(selectedIds);
  if (checked) next.add(itemId);
  else next.delete(itemId);
  return next;
}

export function toggleAllInventorySelection(selectedIds, visibleItems, checked) {
  const next = new Set(selectedIds);
  for (const item of visibleItems) {
    if (checked) next.add(item.id);
    else next.delete(item.id);
  }
  return next;
}

export function selectedInventoryItems(selectedIds, visibleItems) {
  return visibleItems.filter((item) => selectedIds.has(item.id));
}
