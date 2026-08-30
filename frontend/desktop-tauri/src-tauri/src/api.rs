use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SecurityEvent<'a> {
    device_id: &'a str,
    event_type: &'a str,
    source: &'a str,
    details: &'a str,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreRequest {
    pub id: String,
    pub original_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RestoreResult<'a> {
    succeeded: bool,
    result_path: Option<&'a str>,
    error: Option<&'a str>,
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

    pub async fn security_event(
        &self,
        device_id: &str,
        event_type: &str,
        source: &str,
        details: &str,
    ) -> Result<(), String> {
        self.client
            .post(format!("{}/security-events", self.base_url))
            .bearer_auth(&self.token)
            .json(&SecurityEvent {
                device_id,
                event_type,
                source,
                details,
            })
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn pending_restores(&self, device_id: &str) -> Result<Vec<RestoreRequest>, String> {
        self.client
            .get(format!(
                "{}/backups/restore-requests/pending",
                self.base_url
            ))
            .bearer_auth(&self.token)
            .query(&[("deviceId", device_id)])
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn download_restore(
        &self,
        request_id: &str,
        device_id: &str,
        destination: &Path,
    ) -> Result<PathBuf, String> {
        let mut response = self
            .client
            .get(format!(
                "{}/backups/restore-requests/{request_id}/content",
                self.base_url
            ))
            .bearer_auth(&self.token)
            .query(&[("deviceId", device_id)])
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        let mut file = tokio::fs::File::create(destination)
            .await
            .map_err(|e| e.to_string())?;
        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        }
        file.flush().await.map_err(|e| e.to_string())?;
        Ok(destination.to_path_buf())
    }

    pub async fn complete_restore(
        &self,
        request_id: &str,
        device_id: &str,
        result: Result<&str, &str>,
    ) -> Result<(), String> {
        let body = match result {
            Ok(path) => RestoreResult {
                succeeded: true,
                result_path: Some(path),
                error: None,
            },
            Err(error) => RestoreResult {
                succeeded: false,
                result_path: None,
                error: Some(error),
            },
        };
        self.client
            .post(format!(
                "{}/backups/restore-requests/{request_id}/complete",
                self.base_url
            ))
            .bearer_auth(&self.token)
            .query(&[("deviceId", device_id)])
            .json(&body)
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

    #[tokio::test]
    async fn records_authenticated_file_move_event() {
        let server = MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(POST).path("/api/security-events").header("authorization", "Bearer test-token")
                .json_body_obj(&serde_json::json!({"deviceId":"device-1","eventType":"FILE_MOVED","source":"C:\\old.txt","details":"{\"destination\":\"D:\\\\new.txt\"}"}));
            then.status(200);
        });
        ApiClient::new(format!("{}/api", server.base_url()), "test-token".into())
            .security_event(
                "device-1",
                "FILE_MOVED",
                r"C:\old.txt",
                r#"{"destination":"D:\\new.txt"}"#,
            )
            .await
            .unwrap();
        mock.assert();
    }

    #[tokio::test]
    async fn polls_downloads_and_completes_restore_request() {
        let server = MockServer::start();
        let pending = server.mock(|when, then| {
            when.method(GET)
                .path("/api/backups/restore-requests/pending")
                .query_param("deviceId", "device-1");
            then.status(200).json_body_obj(
                &serde_json::json!([{"id":"restore-1","originalPath":"C:\\Work\\file.txt"}]),
            );
        });
        let download = server.mock(|when, then| {
            when.method(GET)
                .path("/api/backups/restore-requests/restore-1/content")
                .query_param("deviceId", "device-1");
            then.status(200).body("encrypted");
        });
        let complete = server.mock(|when, then| { when.method(POST).path("/api/backups/restore-requests/restore-1/complete").query_param("deviceId", "device-1").json_body_obj(&serde_json::json!({"succeeded":true,"resultPath":"C:\\Work\\file.restored.txt","error":null})); then.status(204); });
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("restore.backup");
        let client = ApiClient::new(format!("{}/api", server.base_url()), "token".into());
        let jobs = client.pending_restores("device-1").await.unwrap();
        client
            .download_restore(&jobs[0].id, "device-1", &target)
            .await
            .unwrap();
        client
            .complete_restore(&jobs[0].id, "device-1", Ok(r"C:\Work\file.restored.txt"))
            .await
            .unwrap();
        assert_eq!(std::fs::read(target).unwrap(), b"encrypted");
        pending.assert();
        download.assert();
        complete.assert();
    }
}
