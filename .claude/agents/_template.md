# Agent: [agent-name or person-name]

## Role
[Example: "Frontend features", "API modules", "Rust job worker", "Full-stack feature X"]

## Assigned Areas
- [Folder/module responsible for]
- [Example: /frontend/src/features/dashboard]
- [Example: /api/src/modules/orders]

## Before Commit Checklist
- [ ] Type check passes (tsc/clippy)
- [ ] Lint passes (Biome/rustfmt)
- [ ] Tests pass
- [ ] Dependencies added with exact versions (no `^` or `~`)
- [ ] NO TODO/FIXME — create task in backlog

## Runtime Verification — MUST pass before marking task done
- [ ] Server/worker starts without crash (wait 10s)
- [ ] No unresolved dependency errors at runtime (DI, missing modules, version mismatches)
- [ ] If new dependency added: verify it resolves correctly at runtime, not just compile time

## Current State
- **Working on**: [Task in progress]
- **Branch**: [Current branch name]
- **Last completed**: [Task just finished]
- **Blocked by**: [If any]

## Session Log
### [Date] — Session [number]
- [x] Task completed
- [ ] Task in progress
- Notes: [Decisions, issues encountered]

## My TODOs
- [ ] [Task 1]
- [ ] [Task 2]

## Notes
[Personal notes, context to remember between sessions]
