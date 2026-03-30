/**
 * Job Envelope — shared type for job payload between NestJS → Redis → Rust.
 *
 * NestJS uses this type when enqueueing.
 * Rust mirrors this struct in `jobs/src/queue.rs::JobEnvelope`.
 */

import type { JobType } from "../constants/job-types";

export interface JobEnvelope<TData = unknown> {
  id: string;
  type: JobType;
  data: TData;
  createdAt: string;
  attempts: number;
}
