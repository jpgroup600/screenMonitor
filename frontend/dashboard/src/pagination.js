export const INVENTORY_PAGE_SIZE = 100;

export function pageQuery(page, pageSize = INVENTORY_PAGE_SIZE) {
  const safePage = Math.max(0, Number.isFinite(page) ? Math.floor(page) : 0);
  return { skip: safePage * pageSize, take: pageSize };
}

export function canMoveToNextPage(items, pageSize = INVENTORY_PAGE_SIZE) {
  return items.length === pageSize;
}
