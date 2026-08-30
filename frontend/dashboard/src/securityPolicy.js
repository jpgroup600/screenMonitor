export const securityPolicyModules = [
  ['monitoringEnabled', '전체 보안 모니터링', '모든 수집 모듈의 최상위 스위치'],
  ['screenshotsEnabled', '화면 캡처', '등록된 모든 모니터 화면 캡처'],
  ['activeAppTrackingEnabled', '활성 프로그램', '현재 사용 중인 프로그램 기록'],
  ['idleTrackingEnabled', '유휴 시간', '키보드·마우스 입력이 없는 시간 기록'],
  ['backupEnabled', '파일 백업', '고정 드라이브 목록 수집 및 암호화 백업'],
  ['usbAuditEnabled', 'USB 연결 감사', '이동식 드라이브 연결·해제 기록'],
  ['usbFileCopyAuditEnabled', 'USB 파일 쓰기 감사', '이동식 드라이브에 새로 생기거나 변경된 파일 기록'],
  ['networkAuditEnabled', '외부 연결 감사', '새로운 외부 TCP 연결 기록(파일 전송 확정 아님)'],
  ['fileChangeAuditEnabled', '파일 변경 감사', '파일 생성·수정·이동·삭제 기록'],
  ['attendanceRemindersEnabled', '출근 알림', '미출근 상태에서 10분 간격 알림'],
  ['restoreEnabled', '원격 복원', '관리자가 요청한 백업 버전을 원본 PC에 복원'],
  ['retentionEnabled', '백업 자동 정리', '보존 기간·장치 용량·파일별 버전 수에 따라 오래된 백업 정리'],
];

export function updateSecurityPolicy(policy, key, enabled) {
  if (!securityPolicyModules.some(([candidate]) => candidate === key)) throw new Error('Unknown security policy module');
  return { ...policy, [key]: enabled };
}

export function securityPolicyPayload(policy) {
  return {
    ...Object.fromEntries(securityPolicyModules.map(([key]) => [key, Boolean(policy[key])])),
    retentionDays: boundedInteger(policy.retentionDays, 1, 3650, 90),
    maxBackupBytes: boundedInteger(policy.maxBackupBytes, 1024 * 1024, 10 * 1024 ** 4, 50 * 1024 ** 3),
    maxVersionsPerFile: boundedInteger(policy.maxVersionsPerFile, 1, 1000, 20),
  };
}

function boundedInteger(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
