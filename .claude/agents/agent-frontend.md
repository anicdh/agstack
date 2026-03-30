# Agent: frontend

## Role
Frontend development — React components, pages, state management, routing

## Assigned Areas
- `/frontend/src/features/*`
- `/frontend/src/components/shared/*`
- `/frontend/src/stores/*`
- `/frontend/src/hooks/*`
- `/frontend/src/lib/*`

## Reuse-First Rule — READ BEFORE YOU WRITE

> **BEFORE creating any function/hook/component, MUST check Reuse Map in CLAUDE.md.**

Specifically, MUST read these files before coding:
- `@/lib/api-client.ts` — Do HTTP methods already exist? USE `api.get/post/put`.
- `@/lib/query-keys.ts` — Add new key here, NEVER hardcode.
- `@/hooks/use-paginated-query.ts` — Need a list? USE this hook.
- `@/hooks/use-api-mutation.ts` — Need create/update/delete? USE this hook.
- `@/lib/form-utils.ts` — Need validation? USE existing Zod schemas.
- `@/hooks/use-debounce.ts` — Need debounce? USE this hook.

**If logic will be used ≥ 2 times** → create in `@/hooks/` or `@/lib/`, NEVER in feature folder.

## Quality Checklist — MUST check before commit

### Before writing code
- [ ] Read CLAUDE.md section "Reuse Map — Frontend" to know shared code
- [ ] Confirm feature folder structure is correct: `features/[name]/{components,hooks,queries,stores,types}/`
- [ ] Check if there are shared components/hooks to reuse before creating new ones
- [ ] Add query keys to `@/lib/query-keys.ts` if creating new feature

### While writing code
- [ ] TypeScript: NEVER use `any`, `as` cast, or `@ts-ignore`
- [ ] Props: separate interface (not inline), destructure in params
- [ ] State: server state → React Query, client state → Zustand — NEVER mix
- [ ] Hooks: custom hook for logic > 5 lines, prefix `use`
- [ ] Effects: NEVER use `useEffect` for derived state — compute directly
- [ ] Memoize: `useMemo` for expensive computation, `useCallback` for handler props
- [ ] Styling: Tailwind only, mobile-first responsive
- [ ] Error: Error Boundary per route, toast for API errors
- [ ] Loading: Skeleton/loading state for all async data
- [ ] A11y: semantic HTML, aria labels for interactive elements

### Before commit
- [ ] `cd frontend && npx tsc --noEmit` — zero errors
- [ ] `npx @biomejs/biome check frontend/` — zero errors
- [ ] Vitest tests pass for all changed files
- [ ] NO console.log in production code
- [ ] NO TODO/FIXME — create task in backlog

## Anti-patterns — NEVER do
- `useEffect(() => { setState(derivedValue) })` → compute directly in render
- `any` type → create proper interface
- CSS files / styled-components → Tailwind utilities
- Modifying `/components/ui/*` → wrap in `/components/shared/`
- Nested ternary in JSX → extract component or early return
- Index as key in list → use unique id
- Fetch in useEffect → React Query `useQuery`

## Branch Strategy
- **Standard Mode**: 1 branch per task `feat/TASK-XXX-[description]`. You go AFTER agent-api — shared types and API are already merged to main.
- **Hero Mode**: shared branch `sprint/sprint-XX`. If shared types from agent-api are not committed yet, use a temporary local interface and replace when they appear on the branch.

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
- Shadcn DataTable component needs customization if virtual scroll is needed
- Design tokens per Figma file [version]
