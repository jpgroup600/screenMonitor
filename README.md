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

## Docker로 로컬 실행

Docker Desktop만 설치한 뒤 저장소 루트에서 실행합니다. PostgreSQL, .NET API,
관리자 대시보드가 함께 시작되고 DB 마이그레이션도 자동 적용됩니다.

```powershell
docker compose up --build
```

- 관리자 대시보드: `http://localhost:5173`
- API: `http://localhost:5265`
- Swagger: `http://localhost:5265/swagger`
- 상태 확인: `http://localhost:5265/health`

종료할 때는 다음 명령을 사용합니다.

```powershell
docker compose down
```

DB와 스크린샷은 Docker 볼륨에 유지됩니다. 데이터까지 완전히 지우려는 경우에만
`docker compose down -v`를 사용합니다.

직원용 Electron 앱은 화면 캡처와 Windows 프로그램 감지를 사용하므로 Docker 밖에서
실행해야 합니다. `frontend/desktop/.env.example`을 `.env`로 복사한 뒤 실행합니다.

```powershell
cd frontend\desktop
Copy-Item .env.example .env
npm install
npm run build
npm start
```

## Railway 배포

백엔드 서비스는 루트의 `railway.json`과 `backend/Dockerfile`을 사용합니다. Railway
프로젝트에 PostgreSQL 서비스를 추가하고 백엔드 서비스에 다음 변수를 설정합니다.

```text
ConnectionStrings__SmDb=<Railway PostgreSQL 연결 문자열>
JWT__Key=<길고 무작위인 운영용 키>
FileStorage__UploadPath=/app/Uploads
ApplyMigrations=true
```

스크린샷을 유지하려면 백엔드 서비스에 Railway Volume을 추가하여 `/app/Uploads`에
마운트합니다. 배포 후 생성된 도메인이 `https://example.up.railway.app`라면 클라이언트
설정은 다음과 같습니다.

```dotenv
VITE_BACKEND_URL=https://example.up.railway.app/api
VITE_IMAGE_URL=https://example.up.railway.app/Uploads
VITE_HUB_URL=https://example.up.railway.app/useractivityhub

BACKEND_URL=https://example.up.railway.app/api
HUB_URL=https://example.up.railway.app/useractivityhub
```
