//! Database pool — shared PostgreSQL connection pool.
//!
//! Create once in main, pass reference to job handlers.
//! DO NOT create a new pool per job. DO NOT clone pool (it is already Arc internally).
//!
//! # Example
//! ```rust
//! let pool = db::create_pool(&config.database_url).await?;
//! process_email_job(&pool, payload).await?;
//! ```

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

use crate::error::AppError;

/// Create a new connection pool. Call once in main().
pub async fn create_pool(database_url: &str) -> Result<PgPool, AppError> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .connect(database_url)
        .await
        .map_err(|e| AppError::Database(format!("Failed to create pool: {e}")))?;

    tracing::info!("Database pool created successfully");
    Ok(pool)
}
