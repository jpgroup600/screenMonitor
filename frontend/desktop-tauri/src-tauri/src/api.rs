use reqwest::Client;
use serde::Serialize;
use std::path::Path;

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
}
