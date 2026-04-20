/**
 * Job type constants — single source of truth for job types.
 *
 * Each worker profile MUST mirror these constants:
 * - nestjs-only: BullMQ processors in `api/src/workers/` (same TS, no mirror needed)
 * - nestjs-rust: Rust enum in `jobs/src/jobs/mod.rs::types`
 * - go-only:     Go constants in `backend-go/internal/jobs/types.go`
 * - python-only: Python enum in `backend-python/app/jobs/types.py`
 *
 * When adding/modifying job types here, MUST update the mirror for your profile.
 */

export const JOB_TYPES = {
  EMAIL: "email",
  IMAGE: "image",
  REPORT: "report",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/**
 * Queue name from job type.
 * @example queueName("email") → "jobs:email"
 */
export function queueName(jobType: JobType): string {
  return `jobs:${jobType}`;
}

/**
 * Dead letter queue name.
 * @example deadLetterQueue("email") → "jobs:dead:email"
 */
export function deadLetterQueue(jobType: JobType): string {
  return `jobs:dead:${jobType}`;
}
