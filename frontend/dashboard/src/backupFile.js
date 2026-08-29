export function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / (1024 ** index);
  return `${Number(amount.toFixed(index === 0 ? 0 : 1))} ${units[index]}`;
}

export function newestVersionsFirst(versions = []) {
  return [...versions].sort((left, right) => new Date(right.uploadedAt) - new Date(left.uploadedAt));
}
