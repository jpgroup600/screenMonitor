export function inventoryHeartbeat(lastProgressAt, now = Date.now()) {
  if (!lastProgressAt) return { label: '응답 대기', tone: 'text-slate-400' };
  const age = Math.max(0, now - new Date(lastProgressAt).getTime());
  if (age < 60_000) return { label: '정상', tone: 'text-emerald-400' };
  if (age < 300_000) return { label: '지연', tone: 'text-amber-400' };
  return { label: '응답 없음', tone: 'text-rose-400' };
}

export function canStartInventoryBackup(progress) {
  return Boolean(progress && ['Scanning', 'InventoryReady'].includes(progress.status) && !progress.backupRequested);
}

export function inventoryBackupButtonLabel(progress) {
  if (progress?.backupRequested && progress.status === 'Scanning') return '스캔·백업 진행 중';
  if (progress?.status === 'Scanning') return '발견 파일 백업 시작';
  if (progress?.status === 'BackingUp') return '백업 진행 중';
  if (progress?.status === 'Completed') return '백업 완료';
  return '백업 시작';
}
