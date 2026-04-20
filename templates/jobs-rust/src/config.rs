//! App Config — load environment variables once, use globally.
//!
//! DO NOT use `std::env::var()` directly in code.
//! ALWAYS retrieve config via `AppConfig::from_env()`.
//!
//! # Example
//! ```rust
//! let config = AppConfig::from_env()?;
//! let pool = db::create_pool(&config.database_url).await?;
//! ```

use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub redis_url: String,
    pub worker_concurrency: usize,
    pub rust_log: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, AppError> {
        Ok(Self {
            database_url: get_env("DATABASE_URL")?,
            redis_url: get_env_or("REDIS_URL", "redis://localhost:6379"),
            worker_concurrency: get_env_or("WORKER_CONCURRENCY", "4")
                .parse()
                .map_err(|e| AppError::Config(format!("Invalid WORKER_CONCURRENCY: {e}")))?,
            rust_log: get_env_or("RUST_LOG", "info"),
        })
    }
}

fn get_env(key: &str) -> Result<String, AppError> {
    std::env::var(key).map_err(|_| AppError::Config(format!("Missing env var: {key}")))
}

fn get_env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}
