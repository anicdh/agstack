# ADR 002: Rust for Background Jobs

## Status
Accepted

## Context
Need a job worker for CPU-intensive background tasks (crawling, data processing, report generation, image processing). Options: Node.js worker (BullMQ processor), Python worker, Rust worker.

## Decision
Use **Rust** with Tokio async runtime for the job worker.

## Reasons
- 10-100x performance over Node.js for CPU-intensive tasks (no GC pauses)
- Memory-safe without garbage collector — predictable latency
- Tokio provides excellent async I/O for Redis and database operations
- Strong type system catches errors at compile time
- Single binary deployment — no runtime dependencies

## Trade-offs
- Higher learning curve than Node.js for most web developers
- Slower development iteration (compile times)
- Separate type definitions — must manually mirror TypeScript shared types
- Smaller hiring pool if team grows

## Alternatives considered
- **Node.js (BullMQ processor)**: Simpler setup, shared codebase with API, but GC pauses and single-threaded CPU limitations
- **Python**: Good for data/ML tasks, but slower than Rust and adds another runtime to manage
