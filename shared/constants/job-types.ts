/**
 * Job type constants — single source of truth for job types.
 *
 * MUST mirror in Rust: `jobs/src/jobs/mod.rs::types`
 * When adding/modifying job types here, MUST update Rust mirror.
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
