const aliases = new Map([
  ['바탕화면', 'Desktop'],
  ['바탕 화면', 'Desktop'],
  ['문서', 'Documents'],
  ['다운로드', 'Downloads'],
]);

export function normalizeFolderSearch(value) {
  const trimmed = value.trim();
  return aliases.get(trimmed) || trimmed;
}

export function folderDisplayName(folder) {
  if (folder.name === 'Desktop') return '바탕화면';
  if (folder.name === 'Documents') return '문서';
  if (folder.name === 'Downloads') return '다운로드';
  return folder.name;
}

export function effectiveFolderRule(path, rules = []) {
  const normalized = path.replaceAll('/', '\\').replace(/\\+$/, '').toLowerCase();
  const matching = rules.filter((rule) => {
    const candidate = rule.path.replaceAll('/', '\\').replace(/\\+$/, '').toLowerCase();
    return normalized === candidate || normalized.startsWith(`${candidate}\\`);
  }).sort((left, right) => right.path.length - left.path.length);
  if (!matching.length) return { action: 'Include', inherited: true, source: null };
  return { action: matching[0].action, inherited: matching[0].path.toLowerCase() !== path.toLowerCase(), source: matching[0].path };
}

export function splitExplicitRules(rules = []) {
  const newest = [...rules].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  return {
    included: newest.filter((rule) => rule.action === 'Include'),
    excluded: newest.filter((rule) => rule.action === 'Exclude'),
  };
}
