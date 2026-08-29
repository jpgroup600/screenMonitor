use reqwest::Client;
use serde::Serialize;
use std::path::Path;
use tokio_util::io::ReaderStream;

#[derive(Clone)]
pub struct ApiClient {
    base_url: String,
    token: String,
    client: Client,
}

#[derive(Serialize)]
struct AppEvent<'a> {
    #[serde(rename = "appName")]
    app_name: &'a str,
}

#[derive(Serialize)]
struct IdleEvent<'a> {
    event: &'a str,
}

impl ApiClient {
    pub fn new(base_url: String, token: String) -> Self {
        Self {
            base_url,
            token,
            client: Client::new(),
        }
    }

    pub async fn app_event(&self, kind: &str, app_name: &str) -> Result<(), String> {
        self.client
            .post(format!("{}/sessionForegroundApp/{}", self.base_url, kind))
            .bearer_auth(&self.token)
            .json(&AppEvent { app_name })
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn attendance_idle_event(&self, event: &str) -> Result<(), String> {
        self.client
            .post(format!("{}/attendance/idle", self.base_url))
            .bearer_auth(&self.token)
            .json(&IdleEvent { event })
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn upload(&self, path: &Path) -> Result<(), String> {
        let bytes = tokio::fs::read(path).await.map_err(|e| e.to_string())?;
        self.upload_bytes(bytes).await
    }

    pub async fn upload_bytes(&self, bytes: Vec<u8>) -> Result<(), String> {
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name("screenshot.png")
            .mime_str("image/png")
            .map_err(|e| e.to_string())?;
        self.client
            .post(format!("{}/screenshots/upload", self.base_url))
            .bearer_auth(&self.token)
            .multipart(reqwest::multipart::Form::new().part("image", part))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn upload_backup(
        &self,
        device_id: &str,
        original_path: &str,
        content_hash: &str,
        plain_size_bytes: u64,
        source_modified_unix_seconds: u64,
        encrypted_path: &Path,
    ) -> Result<(), String> {
        let file = tokio::fs::File::open(encrypted_path)
            .await
            .map_err(|e| e.to_string())?;
        let encrypted_size = file.metadata().await.map_err(|e| e.to_string())?.len();
        let part = reqwest::multipart::Part::stream_with_length(
            reqwest::Body::wrap_stream(ReaderStream::new(file)),
            encrypted_size,
        )
        .file_name("encrypted.smbackup")
        .mime_str("application/octet-stream")
        .map_err(|e| e.to_string())?;
        self.client
            .post(format!("{}/backups/upload", self.base_url))
            .bearer_auth(&self.token)
            .multipart(
                reqwest::multipart::Form::new()
                    .text("deviceId", device_id.to_owned())
                    .text("originalPath", original_path.to_owned())
                    .text("contentHash", content_hash.to_owned())
                    .text("plainSizeBytes", plain_size_bytes.to_string())
                    .text(
                        "sourceModifiedUnixSeconds",
                        source_modified_unix_seconds.to_string(),
                    )
                    .part("encryptedFile", part),
            )
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;

    #[tokio::test]
    async fn sends_authenticated_app_transition() {
        let server = MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(POST)
                .path("/api/sessionForegroundApp/start")
                .header("authorization", "Bearer test-token")
                .json_body_obj(&serde_json::json!({"appName":"Code.exe"}));
            then.status(200);
        });
        ApiClient::new(format!("{}/api", server.base_url()), "test-token".into())
            .app_event("start", "Code.exe")
            .await
            .unwrap();
        mock.assert();
    }

    #[tokio::test]
    async fn sends_attendance_idle_transition() {
        let server = MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(POST)
                .path("/api/attendance/idle")
                .header("authorization", "Bearer test-token")
                .json_body_obj(&serde_json::json!({"event":"start"}));
            then.status(204);
        });
        ApiClient::new(format!("{}/api", server.base_url()), "test-token".into())
            .attendance_idle_event("start")
            .await
            .unwrap();
        mock.assert();
    }

    #[tokio::test]
    async fn streams_authenticated_encrypted_backup() {
        let server = MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(POST)
                .path("/api/backups/upload")
                .header("authorization", "Bearer test-token")
                .body_includes("device-1")
                .body_includes("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
                .body_includes("encrypted.smbackup");
            then.status(200);
        });
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("file.backup");
        std::fs::write(&path, b"encrypted").unwrap();
        ApiClient::new(format!("{}/api", server.base_url()), "test-token".into())
            .upload_backup(
                "device-1",
                r"C:\Work\file.txt",
                &"a".repeat(64),
                9,
                1,
                &path,
            )
            .await
            .unwrap();
        mock.assert();
    }
}
