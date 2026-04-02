---
name: agent-[name]
description: >
  [What this agent does — role, stack, responsibilities]
required_skills:
  - [skill-name-1]
  - [skill-name-2]
---

# Agent: [agent-name or person-name]

## Role
[Example: "Frontend features", "API modules", "Rust job worker", "Full-stack feature X"]

## Required Reading (BEFORE any code)
1. `.claude/rules/anti-hallucination.md` — every claim needs evidence
2. [Stack-specific docs — e.g., ux-guide.md for frontend, rust SKILL.md for jobs]
3. `CLAUDE.md` section "Reuse Map" for your stack
4. If GitNexus available (`npx gitnexus status`): use it for code navigation

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
