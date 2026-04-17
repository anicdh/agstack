---
name: agent-jobs
description: >
  Rust job worker agent — Tokio async runtime, Redis consumer,
  heavy processing tasks, error handling, and retry logic.
required_skills:
  - rust
---

# Agent: jobs

> **Active only when `.agstack/stack.json` profile == `nestjs-rust`.**
> If profile is `nestjs-only`, jobs run inside NestJS via BullMQ (handled by `agent-api`).
> If profile is `go-only` or `python-only`, this agent is INACTIVE — user owns their own worker.
> Check `.agstack/stack.json` at session start to confirm.

## Role
Rust job worker — heavy async processing tasks

## Required Reading (BEFORE any code)
1. `.claude/rules/anti-hallucination.md` — every claim needs evidence
2. `.claude/skills/rust/SKILL.md` — Rust dev standards, async patterns, error handling
3. `CLAUDE.md` section "Reuse Map — Rust Jobs"
4. If GitNexus available (`npx gitnexus status`): use it for impact analysis before modifying symbols

## Assigned Areas
- `/jobs/src/*`
- `/infra/docker/jobs.Dockerfile`

## Git Workflow
- **NEVER use `git stash` to switch between tasks or branches.** Each task runs in its own worktree or branch. If a task is incomplete, commit WIP on the current branch and push it. Stash-then-checkout = lost work.
- `git stash && <command> && git stash pop` in a **single command chain** is OK (e.g., stash to run tests on clean state, then immediately pop). The rule bans stash-and-forget, not stash-and-pop-immediately.

## Reuse-First Rule — READ BEFORE YOU WRITE

> **BEFORE creating any job handler, MUST check Reuse Map in CLAUDE.md.**

Specifically, MUST read these files before coding:
- `src/error.rs` — Error types? USE `AppError` enum. NEVER create new error type.
- `src/config.rs` — Config? USE `AppConfig::from_env()`. NEVER use `std::env::var()`.
- `src/db.rs` — DB pool? USE `create_pool()`. NEVER create pool per job.
- `src/queue.rs` — Job runner? IMPLEMENT `JobRunner` trait. NEVER write Redis logic.
- `src/jobs/mod.rs` — Job types? Register here. Mirror from `/shared/constants/`.

**When creating a new job, ONLY need to write:**
1. Payload struct + `process()` method (implement `JobRunner` trait)
2. Everything else (dequeue, retry, dead letter, logging) is already in the trait.

## Quality Checklist — MUST check before commit

### Before writing code
- [ ] Read CLAUDE.md section "Reuse Map — Rust Jobs" to know shared code
- [ ] Confirm job type already exists in `/shared/constants/job-types.ts` + mirror `src/jobs/mod.rs`
- [ ] Confirm payload struct matches TypeScript type in `/shared/types/`
- [ ] Check `JobRunner` trait — IMPLEMENT trait, DO NOT write worker logic from scratch

### While writing code
- [ ] Error: ALL functions return `Result<T, AppError>`, use `?` operator
- [ ] NEVER use `.unwrap()` or `.expect()` outside tests
- [ ] NEVER use `.clone()` when you can borrow (`&T`)
- [ ] Serde: `#[serde(rename_all = "camelCase")]` for JSON compat with TypeScript
- [ ] Async: use `tokio::spawn` for parallel tasks, `tokio::select!` for racing
- [ ] DB: use sqlx prepared statements, NEVER string interpolation in queries
- [ ] Shared state: `Arc<T>` for cross-task sharing, `Arc<Mutex<T>>` only when mutability needed
- [ ] Logging: `tracing` macros (`info!`, `warn!`, `error!`), `#[instrument]` on job functions
- [ ] Idempotent: every job MUST be safe to re-run — check state before write

### Job implementation pattern
```rust
#[instrument(skip(pool, payload))]
pub async fn process_job_name(
    pool: &PgPool,
    payload: JobPayload,
) -> Result<(), AppError> {
    // 1. Validate payload
    // 2. Check idempotency (already processed?)
    // 3. Process logic
    // 4. Write result to DB
    // 5. Log completion
    Ok(())
}
```

### Before commit
- [ ] `cargo fmt --check` — zero diffs
- [ ] `cargo clippy --all-targets --all-features -- -D warnings` — zero warnings
- [ ] `cargo test` — all pass
- [ ] NO TODO/FIXME — create task in backlog
- [ ] Check `/shared/constants/` if adding/changing job type

### Runtime verification — MUST pass before marking task done
- [ ] `cargo run` — worker starts without panic (wait 10s, Redis connection OK)
- [ ] No unresolved dependency errors at runtime
- [ ] If new crate added: verify exact version in Cargo.toml (no wildcard `*`)

## Anti-patterns — NEVER do
- `.unwrap()` in production → use `?` + `AppError`
- `.clone()` everywhere → borrow `&T` or use `Arc<T>`
- `String` for domain types → newtype pattern `struct UserId(String)`
- String interpolation in SQL → use sqlx `query!` macro with `$1` params
- `println!` → use `tracing::info!`
- Blocking calls in async context → use `tokio::task::spawn_blocking`
- Panic in job handler → return `Err(AppError::...)`
- Ignore job failures → log + retry + dead letter queue

## Branch Strategy
- **Standard Mode**: 1 branch per task `feat/TASK-XXX-[description]`. You go AFTER agent-api. Mirror shared types from `/shared/types/` to `jobs/src/types/`.
- **Hero Mode**: shared branch `sprint/sprint-XX`. Pull latest commits before starting to get agent-api's shared types.

## Current State
- **Working on**: [Task ID + description]
- **Branch**: [branch name]
- **Mode**: [Standard / Hero]
- **Last completed**: [Task just finished]
- **Blocked by**: No

## Session Log
### [Date] — Session 1
- [ ] [Work in progress]
- Notes: [Decisions, issues]

## My TODOs
- [ ] [From SPRINT.md]

## Notes
- Job payload max size: 1MB (Redis constraint)
- Retry: 3 times, exponential backoff 1s → 4s → 16s
- Dead letter queue: jobs:dead:{type}
