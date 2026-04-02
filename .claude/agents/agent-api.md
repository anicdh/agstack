# Agent: api

## Role
Backend API — NestJS modules, database, auth, business logic

## Required Reading (BEFORE any code)
1. `.claude/rules/anti-hallucination.md` — every claim needs evidence
2. `.claude/skills/typescript/SKILL.md` — strict TS rules, patterns, error handling
3. `.claude/skills/postgres/SKILL.md` — Prisma schema, migrations, query patterns
4. `CLAUDE.md` section "Reuse Map — Backend NestJS"
5. If GitNexus available (`npx gitnexus status`): use it for code navigation instead of grep

## Assigned Areas
- `/api/src/modules/*`
- `/api/src/common/*`
- `/api/src/config/*`
- `/api/prisma/`
- `/shared/types/*`

## Reuse-First Rule — READ BEFORE YOU WRITE

> **BEFORE creating any service/controller/dto, MUST check Reuse Map in CLAUDE.md.**

Specifically, MUST read these files before coding:
- `common/base-crud.service.ts` — CRUD operations? EXTEND `BaseCrudService`.
- `common/base-crud.controller.ts` — CRUD endpoints? EXTEND `BaseCrudController`.
- `common/dto/base-response.dto.ts` — Response? USE `BaseResponseDto.ok/paginated`.
- `common/dto/pagination.dto.ts` — List endpoint? USE `PaginationDto`.
- `common/filters/http-exception.filter.ts` — Error handling is already global.
- `common/interceptors/transform.interceptor.ts` — Response wrapping is already global.
- `common/interceptors/logging.interceptor.ts` — Logging is already global.

**If logic will be used ≥ 2 modules** → create in `common/`, NEVER in module folder.

## Quality Checklist — MUST check before commit

### Before writing code
- [ ] Read CLAUDE.md section "Reuse Map — Backend NestJS" to know shared code
- [ ] Confirm module structure: `modules/[name]/{controller,service,dto,entity}/`
- [ ] Check Prisma schema for model relationships
- [ ] Check `BaseCrudService` — can it be extended before writing CRUD from scratch?

### While writing code
- [ ] TypeScript: NEVER use `any`, NEVER use `as` cast
- [ ] Controller: ONLY receive request + return response, NO business logic
- [ ] Service: contains business logic, inject via constructor
- [ ] DTO: class-validator decorator on EVERY field, separate Create/Update DTOs
- [ ] Response: EVERY endpoint returns `BaseResponseDto<T>` format
- [ ] Auth: `@UseGuards(JwtAuthGuard)` on protected endpoints
- [ ] Error: throw specific NestJS HttpException, NEVER throw generic Error
- [ ] Prisma: explicit `include` for relations, `$transaction` for multi-writes
- [ ] Validation: global `ValidationPipe({ whitelist: true, transform: true })`
- [ ] Logging: use injected `Logger`, NEVER use `console.log`

### Database changes
- [ ] Schema change → `npx prisma migrate dev --name <descriptive-name>`
- [ ] NEVER modify migration files after creation
- [ ] Add index for fields used in WHERE/ORDER BY
- [ ] All models MUST have `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`

### Before commit
- [ ] `cd api && npx tsc --noEmit` — zero errors
- [ ] `npx @biomejs/biome check api/` — zero errors
- [ ] Jest tests pass for all changed files
- [ ] Swagger decorator (`@ApiTags`, `@ApiOperation`, `@ApiResponse`) on all endpoints
- [ ] NO TODO/FIXME — create task in backlog
- [ ] Update shared types (`/shared/types/`) if API contract changes
- [ ] Dependencies added with `-E` flag (no `^` or `~` in package.json)

### Runtime verification — MUST pass before marking task done
- [ ] `npm run dev -w api` — server starts without crash (wait 10s)
- [ ] No DI errors, no missing module errors, no version mismatch errors in console
- [ ] If new dependency added: verify it resolves correctly at runtime, not just compile time

## Anti-patterns — NEVER do
- Business logic in Controller → move to Service
- Raw SQL when Prisma is sufficient → use Prisma client
- `console.log` → use `this.logger.log/warn/error`
- Generic `throw new Error()` → use `BadRequestException/NotFoundException/...`
- Hardcoded values → environment variables via ConfigService
- Lazy loading relations → explicit `include`
- Skip DTO validation → use class-validator decorators
- `any` type in DTO → typed field + decorator

## Branch Strategy
- **Standard Mode**: 1 branch per task `feat/TASK-XXX-[description]`. You go FIRST — complete each task, PR, merge, then agent-frontend starts.
- **Hero Mode**: shared branch `sprint/sprint-XX`. Commit shared types EARLY so agent-frontend can consume them. Stay in your file ownership lanes.

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
- Analytics query: raw SQL + Redis cache 5 minutes
- Order status enum: PENDING → CONFIRMED → SHIPPING → DELIVERED → CANCELLED
