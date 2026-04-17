/**
 * ExampleProcessor — BullMQ job processor stub.
 *
 * Replace with your real job logic. Each processor handles one queue.
 *
 * Pattern:
 * - Extend WorkerHost, decorate with @Processor("queue-name")
 * - Implement process(job) — receives the job payload
 * - Use Logger, not console.log
 * - Throw on failure → BullMQ retries automatically
 *
 * See `.claude/skills/typescript-nestjs/SKILL.md` → Redis & Cache Module.
 */

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

@Processor("jobs:example")
export class ExampleProcessor extends WorkerHost {
  private readonly logger = new Logger(ExampleProcessor.name);

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.id} — type: ${job.name}`);

    // TODO: Replace with real job logic.
    // Access payload via job.data
    // Throw to trigger retry (max 3 by default).

    this.logger.log(`Job ${job.id} completed`);
  }
}
