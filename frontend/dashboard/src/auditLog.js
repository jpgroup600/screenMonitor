export function auditActionLabel(action) {
  return ({ DEVICE_SECURITY_POLICY_UPDATED: '장치 보안 정책 변경' })[action] || action;
}

export function changedPolicyKeys(beforeJson, afterJson) {
  try {
    const before = JSON.parse(beforeJson || '{}');
    const after = JSON.parse(afterJson || '{}');
    return Object.keys(after).filter((key) => before[key] !== after[key]);
  } catch { return []; }
}
