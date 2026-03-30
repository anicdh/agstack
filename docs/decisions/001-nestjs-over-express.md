# ADR 001: NestJS over Express

## Status
Accepted

## Context
Need a backend framework for the REST API layer. Options: raw Express, Fastify, NestJS.

## Decision
Use **NestJS** as the backend framework.

## Reasons
- Built-in module system with dependency injection — enforces consistent project structure
- Decorator-based validation (class-validator) — cleaner than manual middleware
- First-class Swagger/OpenAPI generation — auto-docs from decorators
- Guards, interceptors, pipes, filters — layered architecture out of the box
- Large ecosystem: @nestjs/passport, @nestjs/bull, @nestjs/config, etc.
- TypeScript-first — no separate type definitions needed

## Trade-offs
- Steeper learning curve than raw Express for devs unfamiliar with DI/decorators
- Slightly heavier runtime than minimal Express
- Opinionated structure — less flexibility for unconventional patterns

## Alternatives considered
- **Raw Express**: Too minimal, leads to inconsistent project structures across features
- **Fastify**: Faster raw performance, but smaller ecosystem and no built-in module system
