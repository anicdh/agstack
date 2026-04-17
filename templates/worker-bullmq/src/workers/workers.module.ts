/**
 * WorkersModule — registers all BullMQ processors.
 *
 * Import this module in AppModule to enable background job processing.
 * Each processor handles one queue type.
 *
 * To add a new processor:
 * 1. Create `src/workers/<name>.processor.ts` extending WorkerHost
 * 2. Register the queue in BullModule.registerQueue() below
 * 3. Add the processor class to `providers` array
 *
 * See `.claude/skills/typescript-nestjs/SKILL.md` → Redis & Cache Module
 * for full patterns and anti-patterns.
 */

import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ExampleProcessor } from "./example.processor";

@Module({
  imports: [
    BullModule.registerQueue({ name: "jobs:example" }),
    // Add more queues here:
    // BullModule.registerQueue({ name: "jobs:email" }),
  ],
  providers: [ExampleProcessor],
})
export class WorkersModule {}
