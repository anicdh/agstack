# BullMQ Worker Template

These files are copied into `api/src/workers/` by `/setup` when the stack profile
is `nestjs-only`. They replace the Rust job worker with a BullMQ processor inside
the NestJS application.

## What's included

- `workers.module.ts` — Module that registers BullMQ queues and processors
- `example.processor.ts` — Stub processor showing the pattern

## After setup

1. Import `WorkersModule` in `AppModule`
2. Replace `example.processor.ts` with your real job processors
3. Enqueue jobs from services using `@InjectQueue('jobs:type')`

See `.claude/skills/typescript-nestjs/SKILL.md` → Redis & Cache Module for
complete patterns, anti-patterns, and the cache invalidation strategy.
