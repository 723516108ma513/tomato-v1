const SERVICE_NAME: &str = "Tomato Companion Auth";
const REFRESH_TOKEN_ACCOUNT: &str = "refresh-token";

fn credential() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_NAME, REFRESH_TOKEN_ACCOUNT)
        .map_err(|error| format!("无法访问 Windows 凭据管理器：{error}"))
}

pub fn save_refresh_token(refresh_token: &str) -> Result<(), String> {
    credential()?
        .set_password(refresh_token)
        .map_err(|error| format!("无法安全保存登录凭据：{error}"))
}

pub fn load_refresh_token() -> Result<Option<String>, String> {
    match credential()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("无法读取登录凭据：{error}")),
    }
}

pub fn delete_refresh_token() -> Result<(), String> {
    match credential()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("无法清除登录凭据：{error}")),
    }
}
