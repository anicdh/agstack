/**
 * Job Envelope — shared type for job payload between API → Redis → Worker.
 *
 * NestJS profiles use this type when enqueueing via BullMQ.
 * Each worker profile MUST mirror this struct/type:
 * - nestjs-only: Same TS type, no mirror needed (BullMQ processors are in-process)
 * - nestjs-rust: Rust struct in `jobs/src/queue.rs::JobEnvelope`
 * - go-only:     Go struct in `backend-go/internal/jobs/envelope.go`
 * - python-only: Pydantic model in `backend-python/app/jobs/envelope.py`
 */

import type { JobType } from "../constants/job-types";

export interface JobEnvelope<TData = unknown> {
  id: string;
  type: JobType;
  data: TData;
  createdAt: string;
  attempts: number;
}
