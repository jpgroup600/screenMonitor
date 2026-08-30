export function auditActionLabel(action) {
  return ({
    DEVICE_SECURITY_POLICY_UPDATED: '장치 보안 정책 변경',
    BACKUP_DETAIL_VIEWED: '백업 상세 조회',
    BACKUP_RESTORE_REQUESTED: '백업 복원 요청',
    INVENTORY_BACKUP_STARTED: '파일 백업 시작',
    BACKUP_PATH_RULE_UPDATED: '파일 백업 규칙 변경',
    BACKUP_PATH_RULES_BULK_UPDATED: '파일 백업 규칙 일괄 변경',
  })[action] || action;
}

export function changedPolicyKeys(beforeJson, afterJson) {
  try {
    const before = JSON.parse(beforeJson || '{}');
    const after = JSON.parse(afterJson || '{}');
    return Object.keys(after).filter((key) => before[key] !== after[key]);
  } catch { return []; }
}
