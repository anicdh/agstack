//! Job registry — central registry for all job types.
//!
//! Add new job:
//! 1. Create file `src/jobs/{job_name}.rs`
//! 2. Implement `JobRunner` trait
//! 3. Register in this file
//! 4. Mirror job type constant to `/shared/constants/job-types.ts`

// pub mod email;
// pub mod image;
// pub mod report;

/// Job type constants — MUST match `/shared/constants/job-types.ts`
pub mod types {
    pub const EMAIL: &str = "email";
    pub const IMAGE: &str = "image";
    pub const REPORT: &str = "report";
}
