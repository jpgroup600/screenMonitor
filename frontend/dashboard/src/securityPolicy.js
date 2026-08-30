export const securityPolicyModules = [
  ['monitoringEnabled', '전체 보안 모니터링', '모든 수집 모듈의 최상위 스위치'],
  ['screenshotsEnabled', '화면 캡처', '등록된 모든 모니터 화면 캡처'],
  ['activeAppTrackingEnabled', '활성 프로그램', '현재 사용 중인 프로그램 기록'],
  ['idleTrackingEnabled', '유휴 시간', '키보드·마우스 입력이 없는 시간 기록'],
  ['backupEnabled', '파일 백업', '고정 드라이브 목록 수집 및 암호화 백업'],
  ['usbAuditEnabled', 'USB 감사', 'USB 연결·해제와 파일 복사 이벤트 기록'],
  ['networkAuditEnabled', '네트워크 감사', '새로운 외부 네트워크 연결 기록'],
  ['fileChangeAuditEnabled', '파일 변경 감사', '파일 생성·수정·이동·삭제 기록'],
  ['attendanceRemindersEnabled', '출근 알림', '미출근 상태에서 10분 간격 알림'],
  ['restoreEnabled', '원격 복원', '관리자가 요청한 백업 버전을 원본 PC에 복원'],
];

export function updateSecurityPolicy(policy, key, enabled) {
  if (!securityPolicyModules.some(([candidate]) => candidate === key)) throw new Error('Unknown security policy module');
  return { ...policy, [key]: enabled };
}

export function securityPolicyPayload(policy) {
  return Object.fromEntries(securityPolicyModules.map(([key]) => [key, Boolean(policy[key])]));
}
