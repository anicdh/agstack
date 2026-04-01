# Definition of Done (DoD)

> A task is only considered "Done" (✅) when ALL criteria below have passed.
> Tasks that only pass AI checks are "Implemented" (🟢), not Done.
> Human refinement is required before a task counts toward velocity.

## Code
- [ ] Code has been merged to main (via PR + approved review)
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] Biome passes (`npx @biomejs/biome check .`), no new warnings
- [ ] Rust: `cargo clippy` passes, no new warnings
- [ ] Dependencies installed with exact versions (`-E` flag, no `^` or `~` in package.json)

## Runtime Verification
- [ ] API server starts successfully (`npm run dev -w api` — no crash within 10s)
- [ ] Frontend dev server starts successfully (`npm run dev -w frontend` — no crash within 10s)
- [ ] Rust worker compiles and starts (`cargo run` — no panic within 10s)
- [ ] No unresolved dependency errors at runtime (DI injection, missing modules, version mismatches)

## Testing
- [ ] Unit tests cover new logic (coverage does not decrease)
- [ ] E2E test for happy path (if UI involved)
- [ ] /qa passes — real browser test, no console errors
- [ ] Edge cases tested (empty state, error state, loading)

## Review
- [ ] /review has run — all applicable review types have passed
- [ ] /design-review passes (if UI changes)
- [ ] /cso passes (if touches auth, data, or external API)

## Documentation
- [ ] API endpoint has Swagger annotation
- [ ] Shared types updated in /shared/types/
- [ ] ADR written (if new architectural decision)
- [ ] Agent file updated "Last completed"

## UX Review — sprint end (marks transition from 🟢 → 🔍)
- [ ] agent-ux spawned after ALL tasks reach 🟢 Implemented
- [ ] agent-ux reviewed all features holistically against `docs/ux-guide.md`
- [ ] Critical issues auto-fixed by agent-ux (toast, spacing, loading states)
- [ ] UX todo list written to `.claude/agents/agent-ux.md` under "Latest Review"

## Human Refinement (marks transition from 🔍 → ✅)
- [ ] Human reviewed agent-ux todo list
- [ ] Human tested features in browser — actual user flow works end-to-end
- [ ] Remaining UX issues fixed or accepted as tech debt (tracked in backlog)
- [ ] Human signs off — task is truly done, not just "AI says it's done"

## Deployment
- [ ] /ship creates PR successfully
- [ ] Docker build passes (if dependencies changed)
- [ ] New env vars added to .env.example

## gStack mapping
| DoD check           | gStack command     |
|---------------------|--------------------|
| Code review         | /review            |
| Test coverage       | /ship (coverage)   |
| Browser test        | /qa                |
| Design quality      | /design-review     |
| Security            | /cso               |
| Docs sync           | /document-release  |
