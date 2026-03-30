//! AppError — unified error type for the entire job worker.
//!
//! EVERY function MUST return `Result<T, AppError>`.
//! DO NOT use `.unwrap()`, `.expect()`, or `panic!()` in production code.
//!
//! # Example
//! ```rust
//! use crate::error::AppError;
//!
//! async fn do_work() -> Result<(), AppError> {
//!     let data = fetch_data().await.map_err(|e| AppError::Redis(e.to_string()))?;
//!     Ok(())
//! }
//! ```

use std::fmt;

#[derive(Debug)]
pub enum AppError {
    /// Database errors (sqlx)
    Database(String),

    /// Redis connection/command errors
    Redis(String),

    /// Job payload parsing errors
    PayloadParse(String),

    /// Job payload validation errors
    PayloadValidation(String),

    /// External service errors (HTTP, SMTP, etc.)
    ExternalService { service: String, message: String },

    /// Job already processed (idempotency check)
    AlreadyProcessed { job_id: String },

    /// Retry limit exceeded
    MaxRetriesExceeded { job_id: String, attempts: u32 },

    /// Configuration errors
    Config(String),

    /// Generic internal errors
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Database(msg) => write!(f, "Database error: {msg}"),
            Self::Redis(msg) => write!(f, "Redis error: {msg}"),
            Self::PayloadParse(msg) => write!(f, "Payload parse error: {msg}"),
            Self::PayloadValidation(msg) => write!(f, "Payload validation error: {msg}"),
            Self::ExternalService { service, message } => {
                write!(f, "External service error [{service}]: {message}")
            }
            Self::AlreadyProcessed { job_id } => {
                write!(f, "Job {job_id} already processed")
            }
            Self::MaxRetriesExceeded { job_id, attempts } => {
                write!(f, "Job {job_id} exceeded max retries ({attempts})")
            }
            Self::Config(msg) => write!(f, "Config error: {msg}"),
            Self::Internal(msg) => write!(f, "Internal error: {msg}"),
        }
    }
}

impl std::error::Error for AppError {}

// ─── Conversions ──────────────────────────────────────────────

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        Self::Database(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        Self::PayloadParse(err.to_string())
    }
}

impl From<redis::RedisError> for AppError {
    fn from(err: redis::RedisError) -> Self {
        Self::Redis(err.to_string())
    }
}

/// Check if error is retryable (network, transient DB, Redis timeout)
impl AppError {
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::Database(_) | Self::Redis(_) | Self::ExternalService { .. }
        )
    }
}
