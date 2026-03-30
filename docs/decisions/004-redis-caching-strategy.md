# ADR 004: Redis for Both Queue and Cache

## Status
Accepted

## Context
Need infrastructure for two purposes: (1) job queue between NestJS API and Rust worker, (2) caching layer for frequently accessed data. Options: separate systems (RabbitMQ + Memcached) or unified Redis.

## Decision
Use **Redis** as both job queue (via BullMQ) and cache layer.

## Reasons
- Single infrastructure component — reduces operational complexity
- BullMQ is battle-tested Redis-based queue with retries, dead letter, priorities
- Redis caching is industry standard with TTL, pub/sub, and atomic operations
- Rust has excellent Redis client (`redis` crate) for the job worker
- One monitoring target instead of two
- Cost-effective for MVP — single Redis instance handles both workloads

## Trade-offs
- Queue and cache share resources — a cache stampede could affect job processing
- Redis is in-memory — job data is not as durable as RabbitMQ with disk persistence
- If Redis goes down, both queue and cache are unavailable

## Mitigation
- Use separate Redis databases (db 0 for cache, db 1 for queue) to logically separate
- Set `maxmemory-policy allkeys-lru` for cache keys only
- For production: consider Redis Sentinel or Cluster for HA
- Monitor memory usage and queue depth with alerts

## Alternatives considered
- **RabbitMQ + Memcached**: More robust queue guarantees, but two systems to manage
- **PostgreSQL LISTEN/NOTIFY**: No extra infrastructure, but limited throughput and no built-in retry
- **AWS SQS + ElastiCache**: Managed services, but vendor lock-in and higher cost for MVP
