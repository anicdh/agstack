---
name: typescript
description: >
  Use when writing or modifying any TypeScript (.ts/.tsx) files in the project.
  Hub skill that routes to specialized sub-skills for core standards, NestJS backend,
  React frontend, async patterns, and Zod schema validation.
  MANDATORY for agent-api and agent-frontend.
invocation: auto
---

# TypeScript — Skill Hub

Quick reference for all TypeScript sub-skills. Match your task to the right skill.

## Always Start Here

For any task involving TypeScript code:

1. **Read `typescript-dev`** — core strict mode rules, type safety (ALWAYS)
2. **Match your task to a sub-skill below** and **read that skill file**
3. **Follow the skill's checklist before committing**

## Sub-Skills

| Task | Skill to read |
|------|---------------|
| Any .ts/.tsx file (strict mode, type safety, naming) | `typescript-dev` |
| NestJS module, controller, service, DTO, Prisma | `typescript-nestjs` |
| React component, hook, page, form, state | `typescript-react` |
| Promise patterns, retry, BullMQ, timeouts | `typescript-async` |
| Zod schema, shared types, API contracts, validation | `typescript-zod` |
| WebSocket, SSE, real-time communication | `typescript-websocket` |

## Quick Decision Tree

```
Writing TypeScript code?
├── ALWAYS read: typescript-dev (strict mode, zero-any, naming)
│
├── Backend (NestJS)?
│   ├── Module/Service/Controller → typescript-nestjs
│   ├── Prisma query/migration → typescript-nestjs + postgres skill
│   ├── Job queue (BullMQ) → typescript-async
│   ├── DTO validation → typescript-zod
│   └── WebSocket/SSE gateway → typescript-websocket
│
├── Frontend (React)?
│   ├── Component/Page → typescript-react + frontend-ui skill
│   ├── Hook/Query → typescript-react
│   ├── Form → typescript-react + typescript-zod
│   ├── State (Zustand) → typescript-react
│   └── Real-time/WebSocket hook → typescript-websocket
│
└── Shared types (/shared/)?
    └── Schema definition → typescript-zod
```

## Key Rules (Quick Reference)

| Rule | Example |
|------|---------|
| Optional props include `\| undefined` | `meta?: PageMeta \| undefined` |
| Index signatures use bracket notation | `process.env["PORT"]` |
| NEVER use `any` | Use `unknown` + Zod validation |
| `as` cast requires comment | `// DOM element guaranteed by app shell` |
| No `console.log` in production | Use NestJS `Logger` or remove |
| No floating promises | `await` or explicit `void` |

## Before Commit

```bash
npx tsc --noEmit              # Zero type errors
npx @biomejs/biome check .    # Zero lint errors
```

## Related Skills

- `frontend-ui` — Tailwind + Shadcn component map, layout patterns
- `postgres` — Prisma schema, migrations, query patterns
- `rust-websocket` — Rust WebSocket client patterns (parallel ecosystem)
