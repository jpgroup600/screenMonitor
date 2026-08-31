# Desktop automatic updates through Railway

The Tauri desktop client checks the Railway API at startup. When a newer signed release exists, it downloads the NSIS installer, verifies its Tauri signature, installs it in passive mode, and restarts.

## One-time setup

1. Mount a Railway Volume at `/app/Updates` on the API service.
2. Set these Railway variables:
   - `DesktopUpdates__StoragePath=/app/Updates`
   - `DesktopUpdates__PublicBaseUrl=https://api-production-18d6.up.railway.app`
   - `DesktopUpdates__PublishingKey=<long-random-secret>`
3. Set these GitHub Actions secrets:
   - `RAILWAY_RELEASE_URL=https://api-production-18d6.up.railway.app`
   - `RAILWAY_RELEASE_KEY` to the same publishing key
   - `TAURI_SIGNING_PRIVATE_KEY` to the contents of `frontend/desktop-tauri/.tauri/screen-monitor.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is empty for the initially generated key

Keep the updater private key in a password manager. Existing installations cannot move to a replacement updater key automatically if it is lost.

## Publish

Update the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json` (and refresh their lockfiles), commit it, then push a matching tag:

```powershell
git tag desktop-v2.0.1
git push origin desktop-v2.0.1
```

The workflow tests and builds the app, creates the signed updater artifact, and uploads it to Railway. The publishing route rejects requests without the release key. The public update feed and installer contain no signing secret.
