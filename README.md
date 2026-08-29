# Screen Monitor

직원 활동과 화면을 모니터링하는 전체 시스템을 하나로 모은 모노레포입니다.

## 구조

```text
frontend/
  dashboard/  관리자용 React/Vite 웹 대시보드
  desktop/    직원용 Electron 데스크톱 앱
backend/
  ScreenshotMonitor.API/      .NET 8 API 서버
  ScreenshotMonitor.Data/     EF Core 데이터 계층 및 마이그레이션
  ScreenshotMonitor.SignalR/  실시간 상태 통신
```

프론트엔드와 데스크톱 앱은 백엔드 API에 의존하므로 전체 시스템을 사용할 때는 두 영역이 모두 필요합니다.

## 로컬 설정

### 1. 백엔드

`backend/ScreenshotMonitor.API/appsettings.json`을 복사해 같은 디렉터리에
`appsettings.Development.json`을 만들고 실제 값을 입력합니다. 개발 설정 파일은 Git에서 제외됩니다.

```json
{
  "ConnectionStrings": {
    "SmDb": "Host=localhost;Port=5432;Database=screenmonitor;Username=postgres;Password=YOUR_PASSWORD"
  },
  "JWT": {
    "Key": "YOUR_LONG_RANDOM_SECRET"
  }
}
```

```powershell
cd backend\ScreenshotMonitor.API
dotnet run
```

기본 HTTP 주소는 `http://localhost:5265`입니다.

### 2. 관리자 대시보드

`frontend/dashboard/.env`에 다음 값을 설정합니다.

```dotenv
VITE_BACKEND_URL=http://localhost:5265/api
VITE_IMAGE_URL=http://localhost:5265/Uploads
```

```powershell
cd frontend\dashboard
npm install
npm run dev
```

### 3. 직원용 데스크톱 앱

`frontend/desktop/.env`를 만들고 다음 값을 설정합니다.

```dotenv
BACKEND_URL=http://localhost:5265/api
```

```powershell
cd frontend\desktop
npm install
npm run build
npm start
```

## 원본 저장소

- 프론트엔드/데스크톱: `jpgroup600/screenMonitor`
- 백엔드: `jpgroup600/screen-monitor-V2`

두 저장소의 Git 이력은 subtree 병합으로 이 저장소에 보존되어 있습니다.
