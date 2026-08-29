# Screen Monitor Tauri desktop

Electron desktop client를 Tauri 2 + Rust로 이전한 Windows 데스크톱 앱입니다. React 화면은 WebView2에서 실행되고, 화면 캡처·활성 프로그램 감지·유휴 시간 감지·백엔드 전송은 Rust가 담당합니다.

## 개발 실행

```powershell
cd frontend/desktop-tauri
npm install
npm run tauri dev
```

백엔드는 기본적으로 Railway의 `https://api-production-18d6.up.railway.app`을 사용합니다.

## 검증

```powershell
npm run build
cd src-tauri
cargo test
```

## 설치 파일 생성

```powershell
npm run tauri build
```

NSIS 설치 파일은 `src-tauri/target/release/bundle/nsis`에 생성됩니다.
