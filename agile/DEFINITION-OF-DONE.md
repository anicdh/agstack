# Definition of Done (DoD)

> A task is only considered "Done" when ALL criteria below have passed.

## Code
- [ ] Code has been merged to main (via PR + approved review)
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] ESLint passes, no new warnings
- [ ] Rust: `cargo clippy` passes, no new warnings

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
