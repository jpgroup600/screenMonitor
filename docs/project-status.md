# Screen Monitor 작업 현황

> 마지막 업데이트: 2026-08-29 (Asia/Seoul)
> 기준 브랜치: `employeeTracker`

이 문서는 완료 기능, 현재 작업, 다음 순서를 팀과 지속적으로 공유하기 위한 기준 문서다.

## 현재 단계

직원용 Tauri 앱, Railway 백엔드, 관리자 출퇴근 화면까지 구현했다. 출근과 모니터링 시작을 하나로 통합했으며 다음 큰 단계는 Windows 서비스와 전사 파일 백업·보안 감사다.

## 완료 기능

### 직원용 Tauri 앱

- 로그인과 배정 프로젝트 조회
- 출근 시작, 실시간 근무 타이머, 퇴근
- 출근 즉시 화면 캡처, 활성 프로그램, 유휴 시간 추적 자동 시작
- 프로젝트를 선택하지 않아도 기본 근무 세션으로 계속 모니터링
- 프로젝트 선택은 모니터링 시작 조건이 아닌 근무 시간 분류 옵션
- 프로젝트 분류 종료 후 기본 근무 모니터링 자동 재개
- 퇴근 시 기본/프로젝트 세션과 활성 프로그램 기록 모두 종료
- 네트워크 또는 SignalR 재연결 시 근무 세션을 임의 종료하지 않음
- 창 닫기와 `Alt+F4` 시 시스템 트레이로 숨김
- 트레이에서 창 복원
- Windows NSIS 설치 파일 생성

### 백엔드와 데이터베이스

- Railway .NET API와 PostgreSQL 운영 배포
- 출근, 퇴근, 현재 상태, 개인 이력 API
- 관리자 출퇴근 보고서 API
- `AttendanceRecords`, `AttendanceIdlePeriods`
- 프로젝트 없는 기본 모니터링 세션 지원 (`Sessions.ProjectId = null`)
- 직원별 활성 출근 기록 1개 제한
- 중복 출근 멱등 처리와 열린 유휴 구간 자동 종료
- 기존 DB 컬럼이 이미 nullable이므로 이번 통합에 추가 마이그레이션은 필요 없음

### 관리자 페이지

- 출퇴근 관리 메뉴와 `/attendance` 화면
- 날짜, 상태, 직원 검색
- 출근·퇴근·근무·유휴·실동 시간 표와 요약 카드

### 검증

- .NET 출퇴근 도메인 테스트 6개
- Rust 단위/API 테스트 4개
- Tauri 웹 프로덕션 빌드
- EF pending-model 변경 없음 확인

## 데이터 구조

- 기존: `Users`, `Projects`, `ProjectEmployees`, `Sessions`, `Screenshots`, `SessionForegroundApps`, `SessionBackgroundApps`
- 출퇴근: `AttendanceRecords`, `AttendanceIdlePeriods`
- 기본 근무 추적은 `Sessions.ProjectId`가 null인 세션으로 저장
- 프로젝트 분류 중에는 해당 프로젝트 ID가 있는 세션으로 전환

## 다음 작업 순서

1. 실제 직원·관리자 계정으로 출근 → 프로젝트 전환 → 프로젝트 종료 → 퇴근 전체 흐름 검증
2. Tauri 추적 코어를 Windows 서비스로 분리해 UI와 독립 실행 및 자동 복구
3. `Devices`, `BackupPolicies`, `BackupJobs`, `Files`, `FileVersions`, `StorageObjects`, `SecurityEvents` 설계
4. 시스템/프로그램/브라우저 비밀 저장소를 제외한 전사 드라이브 파일 인벤토리 TDD 구현
5. 암호화 전체·증분 백업과 S3 또는 Cloudflare R2 연동
6. USB 연결·복사 감사와 네트워크 반출 감사

## 아직 결정할 사항

- 저장소: S3 또는 Cloudflare R2
- 장치별 예상 용량, 파일 최대 크기, 보존 기간
- 개인 사용 허용 폴더와 제외 정책
- 관리자 원본 열람·복원 승인 절차
- 직원 고지, 법률 검토, 접근 권한과 감사 로그 보존 정책

## 운영 원칙

- 직원 앱의 일반 동작에는 감시 경고 팝업을 띄우지 않되, 수집 목적·범위·보존 기간은 사전에 고지한다.
- 실제 파일은 객체 저장소에 암호화해 저장하고 PostgreSQL에는 메타데이터만 둔다.
- 관리자 조회·다운로드·복원도 모두 감사 로그로 남긴다.
- 기능 변경, 배포 결과, 다음 우선순위는 이 문서에 계속 반영한다.

## 관련 문서

- [엔드포인트 백업·보안 기능 제안서](./endpoint-backup-security-proposal.md)
- [Tauri 데스크톱 실행 안내](../frontend/desktop-tauri/README.md)
