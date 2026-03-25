use reqwest::header::{ACCEPT, USER_AGENT};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

const GITHUB_API_BASE: &str = "https://api.github.com";
const UPDATER_ASSET_PREFIX: &str = "updater";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
struct GithubReleaseAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
    published_at: Option<String>,
    prerelease: bool,
    draft: bool,
    assets: Vec<GithubReleaseAsset>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    current_version: String,
    channel: String,
    release_notes: Option<String>,
    release_url: Option<String>,
    published_at: Option<String>,
    manifest_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    configured: bool,
    current_version: String,
    update: Option<UpdateInfo>,
    message: Option<String>,
}

fn updater_repo_owner() -> Option<&'static str> {
    option_env!("TAURI_UPDATER_REPO_OWNER").filter(|value| !value.trim().is_empty())
}

fn updater_repo_name() -> Option<&'static str> {
    option_env!("TAURI_UPDATER_REPO_NAME").filter(|value| !value.trim().is_empty())
}

fn updater_pubkey() -> Option<&'static str> {
    option_env!("TAURI_UPDATER_PUBKEY").filter(|value| !value.trim().is_empty())
}

fn manifest_asset_name() -> String {
    let platform = tauri_plugin_updater::target()
        .unwrap_or_else(|| format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH))
        .replace('_', "-");
    format!("{UPDATER_ASSET_PREFIX}-{platform}.json")
}

fn normalize_version(value: &str) -> Result<semver::Version, String> {
    semver::Version::parse(value.trim_start_matches('v')).map_err(|e| e.to_string())
}

async fn github_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())
}

async fn fetch_github_release(channel: &str) -> Result<GithubRelease, String> {
    let owner = updater_repo_owner()
        .ok_or_else(|| "TAURI_UPDATER_REPO_OWNER is not configured".to_string())?;
    let repo = updater_repo_name()
        .ok_or_else(|| "TAURI_UPDATER_REPO_NAME is not configured".to_string())?;
    let client = github_client().await?;

    if channel == "stable" {
        let url = format!("{GITHUB_API_BASE}/repos/{owner}/{repo}/releases/latest");
        return client
            .get(url)
            .header(USER_AGENT, "tunnel-manager-updater")
            .header(ACCEPT, "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .json::<GithubRelease>()
            .await
            .map_err(|e| e.to_string());
    }

    let url = format!("{GITHUB_API_BASE}/repos/{owner}/{repo}/releases?per_page=20");
    let releases = client
        .get(url)
        .header(USER_AGENT, "tunnel-manager-updater")
        .header(ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<Vec<GithubRelease>>()
        .await
        .map_err(|e| e.to_string())?;

    releases
        .into_iter()
        .find(|release| release.prerelease && !release.draft)
        .ok_or_else(|| "No beta release is currently available".to_string())
}

fn build_update_check_result(
    channel: String,
    current_version: String,
    release: GithubRelease,
) -> Result<UpdateCheckResult, String> {
    let release_version = normalize_version(&release.tag_name)?;
    let current = normalize_version(&current_version)?;

    if release_version <= current {
        return Ok(UpdateCheckResult {
            configured: true,
            current_version,
            update: None,
            message: None,
        });
    }

    let manifest_name = manifest_asset_name();
    let manifest = release
        .assets
        .iter()
        .find(|asset| asset.name == manifest_name)
        .ok_or_else(|| format!("Release {} is missing {}", release.tag_name, manifest_name))?;

    Ok(UpdateCheckResult {
        configured: true,
        current_version: current_version.clone(),
        update: Some(UpdateInfo {
            version: release_version.to_string(),
            current_version,
            channel,
            release_notes: release.body.filter(|body| !body.trim().is_empty()),
            release_url: Some(release.html_url),
            published_at: release.published_at,
            manifest_url: manifest.browser_download_url.clone(),
        }),
        message: None,
    })
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub async fn check_for_app_update(
    channel: String,
    app: AppHandle,
) -> Result<UpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();

    if updater_repo_owner().is_none() || updater_repo_name().is_none() || updater_pubkey().is_none()
    {
        return Ok(UpdateCheckResult {
            configured: false,
            current_version,
            update: None,
            message: Some("Updater is not configured for this build.".to_string()),
        });
    }

    let release = fetch_github_release(&channel).await?;
    build_update_check_result(channel, current_version, release)
}

#[tauri::command]
pub async fn download_and_install_app_update(
    manifest_url: String,
    app: AppHandle,
) -> Result<(), String> {
    let pubkey =
        updater_pubkey().ok_or_else(|| "Updater public key is not configured".to_string())?;
    let endpoint = reqwest::Url::parse(&manifest_url).map_err(|e| e.to_string())?;
    let updater = app
        .updater_builder()
        .pubkey(pubkey)
        .endpoints(vec![endpoint])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Err("No update is available for this build".to_string());
    };

    update
        .download_and_install(|_chunk_length, _content_length| {}, || {})
        .await
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_release(tag_name: &str, asset_name: String) -> GithubRelease {
        GithubRelease {
            tag_name: tag_name.to_string(),
            html_url: "https://example.com/release".to_string(),
            body: Some("notes".to_string()),
            published_at: Some("2026-03-25T00:00:00Z".to_string()),
            prerelease: false,
            draft: false,
            assets: vec![GithubReleaseAsset {
                name: asset_name,
                browser_download_url: "https://example.com/manifest.json".to_string(),
            }],
        }
    }

    #[test]
    fn normalizes_prefixed_version() {
        let version = normalize_version("v1.2.3").expect("version");

        assert_eq!(version, semver::Version::new(1, 2, 3));
    }

    #[test]
    fn returns_no_update_for_same_version() {
        let release = sample_release("v1.0.0", manifest_asset_name());
        let result = build_update_check_result("stable".to_string(), "1.0.0".to_string(), release)
            .expect("result");

        assert!(result.update.is_none());
        assert!(result.message.is_none());
    }

    #[test]
    fn returns_update_when_newer_release_exists() {
        let release = sample_release("v1.1.0", manifest_asset_name());
        let result = build_update_check_result("beta".to_string(), "1.0.0".to_string(), release)
            .expect("result");

        let update = result.update.expect("update");
        assert_eq!(update.version, "1.1.0");
        assert_eq!(update.current_version, "1.0.0");
        assert_eq!(update.channel, "beta");
        assert_eq!(update.manifest_url, "https://example.com/manifest.json");
    }

    #[test]
    fn errors_when_release_manifest_is_missing() {
        let release = sample_release("v1.1.0", "other-asset.json".to_string());
        let error = build_update_check_result("stable".to_string(), "1.0.0".to_string(), release)
            .expect_err("missing manifest should fail");

        assert!(error.contains("missing"));
    }
}
