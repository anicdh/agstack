# ADR 002: Job Worker Strategy (Profile-Based)

## Status
Accepted (updated — originally "Rust for Background Jobs", now multi-profile)

## Context
Background jobs (email, image processing, reports, data sync) need a worker runtime.
Different projects have different performance needs and team skills. A one-size-fits-all
choice forces unnecessary complexity on simple projects or limits performance on demanding ones.

## Decision
Job worker strategy is determined by the stack profile chosen during `/tech-stack-consult`:

| Profile | Job runner | When to choose |
|---------|-----------|----------------|
| **nestjs-only** (default) | BullMQ inside NestJS | Most projects — shared codebase, simplest setup, 1 runtime |
| **nestjs-rust** | Rust + Tokio + Redis consumer | CPU-intensive tasks (image processing, crawling, heavy computation) |
| **go-only** | asynq (Redis-based) | Team knows Go, need concurrency + performance |
| **python-only** | Celery (Redis broker) | Team knows Python, data/ML pipeline jobs |

The default is **nestjs-only with BullMQ** — simplest option, zero extra runtime,
sufficient for most web apps. Rust is available as an upgrade path when profiling
shows BullMQ is a bottleneck.

## Reasons for profile approach
- Most projects never need a separate worker runtime — BullMQ handles 90% of use cases
- Adding Rust/Go/Python worker adds operational complexity (separate build, deploy, monitoring)
- `/tech-stack-consult` asks targeted questions (Q1: job intensity, Q3: team language) to match
- Projects can start with nestjs-only and migrate to nestjs-rust later if needed

## Per-profile trade-offs

### nestjs-only + BullMQ (default)
- ✅ Shared codebase, shared types, 1 Dockerfile, 1 CI pipeline
- ✅ Fastest development iteration
- ❌ Single-threaded CPU — heavy computation blocks the event loop
- ❌ GC pauses under sustained load

### nestjs-rust + Tokio
- ✅ 10-100x performance for CPU-intensive tasks
- ✅ Memory-safe, predictable latency, no GC
- ❌ Higher learning curve, slower dev iteration (compile times)
- ❌ Must mirror TypeScript types manually

### go-only + asynq
- ✅ Excellent concurrency (goroutines), strong stdlib
- ✅ Fast compilation, single binary
- ❌ Less ecosystem for web frameworks than Node.js
- ❌ Error handling verbosity

### python-only + Celery
- ✅ Best ecosystem for data/ML tasks
- ✅ Largest talent pool
- ❌ Slower runtime than Go/Rust
- ❌ GIL limits true parallelism (use multiprocessing for CPU tasks)
