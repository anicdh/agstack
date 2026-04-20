//! Queue consumer — shared Redis job queue logic.
//!
//! USE `JobRunner` trait for each job type. DO NOT write Redis logic per job.
//! Runner handles: dequeue, deserialize, retry, dead letter, logging.
//!
//! # Example — Define a new job
//! ```rust
//! pub struct EmailJob;
//!
//! #[async_trait]
//! impl JobRunner for EmailJob {
//!     type Payload = EmailPayload;
//!     fn job_type(&self) -> &'static str { "email" }
//!     fn max_retries(&self) -> u32 { 3 }
//!
//!     async fn process(&self, pool: &PgPool, payload: Self::Payload) -> Result<(), AppError> {
//!         // job logic here
//!         Ok(())
//!     }
//! }
//! ```
//!
//! # Example — Run the worker
//! ```rust
//! let email_job = EmailJob;
//! email_job.run_worker(&pool, &redis_client).await?;
//! ```

use async_trait::async_trait;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::time::Duration;
use tracing::{error, info, warn};

use crate::error::AppError;

// ─── Job Envelope ─────────────────────────────────────────────

/// Standard job envelope — matches BullMQ format from NestJS.
/// EVERY job payload MUST be wrapped in this envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEnvelope<T> {
    pub id: String,
    #[serde(rename = "type")]
    pub job_type: String,
    pub data: T,
    pub created_at: String,
    pub attempts: u32,
}

// ─── Job Runner Trait ─────────────────────────────────────────

/// Implement this trait for each job type.
/// Runner provides: dequeue, retry, dead letter, structured logging.
#[async_trait]
pub trait JobRunner: Send + Sync {
    /// Payload type — MUST implement serde::Deserialize + serde::Serialize
    type Payload: DeserializeOwned + Send + Sync + std::fmt::Debug;

    /// Job type string — must match BullMQ queue name.
    /// Queue name will be `jobs:{job_type}`
    fn job_type(&self) -> &'static str;

    /// Max retries before sending to dead letter queue. Default: 3
    fn max_retries(&self) -> u32 {
        3
    }

    /// Process a single job. MUST be idempotent.
    async fn process(&self, pool: &PgPool, payload: Self::Payload) -> Result<(), AppError>;

    /// Run the worker loop — dequeue and process jobs continuously.
    async fn run_worker(
        &self,
        pool: &PgPool,
        redis: &redis::Client,
    ) -> Result<(), AppError> {
        let queue_name = format!("jobs:{}", self.job_type());
        let dead_letter = format!("jobs:dead:{}", self.job_type());

        info!(job_type = self.job_type(), queue = %queue_name, "Worker started");

        let mut conn = redis
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| AppError::Redis(e.to_string()))?;

        loop {
            // Blocking pop — wait for next job
            let result: Option<(String, String)> =
                redis::cmd("BRPOP")
                    .arg(&queue_name)
                    .arg(5_u64) // 5 second timeout, then retry loop
                    .query_async(&mut conn)
                    .await
                    .map_err(|e| AppError::Redis(e.to_string()))?;

            let raw = match result {
                Some((_, data)) => data,
                None => continue, // Timeout, loop again
            };

            // Parse envelope
            let envelope: JobEnvelope<Self::Payload> = match serde_json::from_str(&raw) {
                Ok(env) => env,
                Err(e) => {
                    error!(
                        job_type = self.job_type(),
                        error = %e,
                        raw = %raw,
                        "Failed to parse job envelope"
                    );
                    continue;
                }
            };

            let job_id = envelope.id.clone();
            let attempts = envelope.attempts;
            let start = std::time::Instant::now();

            info!(
                job_id = %job_id,
                job_type = self.job_type(),
                attempts = attempts,
                "Processing job"
            );

            match self.process(pool, envelope.data).await {
                Ok(()) => {
                    let duration = start.elapsed();
                    info!(
                        job_id = %job_id,
                        job_type = self.job_type(),
                        duration_ms = duration.as_millis() as u64,
                        status = "success",
                        "Job completed"
                    );
                }
                Err(AppError::AlreadyProcessed { .. }) => {
                    info!(
                        job_id = %job_id,
                        job_type = self.job_type(),
                        status = "skipped",
                        "Job already processed (idempotent)"
                    );
                }
                Err(e) if e.is_retryable() && attempts < self.max_retries() => {
                    let backoff = Duration::from_secs(4_u64.pow(attempts));
                    warn!(
                        job_id = %job_id,
                        job_type = self.job_type(),
                        attempts = attempts + 1,
                        backoff_secs = backoff.as_secs(),
                        error = %e,
                        status = "retrying",
                        "Job failed, scheduling retry"
                    );

                    // Re-enqueue with incremented attempts
                    tokio::time::sleep(backoff).await;
                    let retry_envelope = serde_json::json!({
                        "id": job_id,
                        "type": self.job_type(),
                        "data": serde_json::Value::Null, // Will need raw data preservation
                        "createdAt": chrono::Utc::now().to_rfc3339(),
                        "attempts": attempts + 1,
                    });
                    let _: () = redis::cmd("LPUSH")
                        .arg(&queue_name)
                        .arg(retry_envelope.to_string())
                        .query_async(&mut conn)
                        .await
                        .map_err(|e| AppError::Redis(e.to_string()))?;
                }
                Err(e) => {
                    error!(
                        job_id = %job_id,
                        job_type = self.job_type(),
                        attempts = attempts,
                        error = %e,
                        status = "dead",
                        "Job failed permanently, moving to dead letter"
                    );

                    // Move to dead letter queue
                    let _: () = redis::cmd("LPUSH")
                        .arg(&dead_letter)
                        .arg(&raw)
                        .query_async(&mut conn)
                        .await
                        .map_err(|re| AppError::Redis(re.to_string()))?;
                }
            }
        }
    }
}
