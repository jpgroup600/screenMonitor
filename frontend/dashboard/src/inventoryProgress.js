export function inventoryHeartbeat(lastProgressAt, now = Date.now()) {
  if (!lastProgressAt) return { label: '응답 대기', tone: 'text-slate-400' };
  const age = Math.max(0, now - new Date(lastProgressAt).getTime());
  if (age < 60_000) return { label: '정상', tone: 'text-emerald-400' };
  if (age < 300_000) return { label: '지연', tone: 'text-amber-400' };
  return { label: '응답 없음', tone: 'text-rose-400' };
}

export function canStartInventoryBackup(progress) {
  return progress?.status === 'PlanReady';
}

export function canConfirmInventoryPlan(progress) {
  return progress?.status === 'PolicyDraft';
}

export function inventoryBackupButtonLabel(progress) {
  if (progress?.status === 'Scanning') return '스캔 완료 후 사용 가능';
  if (progress?.status === 'PolicyDraft') return '정책을 먼저 확정하세요';
  if (progress?.status === 'PlanReady') return '확정된 백업 시작';
  if (progress?.status === 'BackingUp') return '백업 진행 중';
  if (progress?.status === 'Completed') return '백업 완료';
  return '백업 시작';
}

export function inventoryBackupPercent(progress) {
  const eligible = Number(progress?.pending || 0) + Number(progress?.backedUp || 0) + Number(progress?.failed || 0);
  if (eligible <= 0) return 0;
  return Math.min(100, Math.round((Number(progress?.backedUp || 0) / eligible) * 100));
}
