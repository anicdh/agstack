# Team Mode Rules

> These rules apply when `Team Mode = team` in CLAUDE.md.
> READ this file at the start of each sprint (during `/plan-sprint`).
> Solo mode ignores this file entirely.

## Branch protection

- `main` is protected — no direct push, PR required with at least 1 approval
- Each dev/agent works on their own feature branch: `feat/TASK-XXX-[description]`
- Merge via PR only — squash merge recommended for clean history

## File claims — before editing a shared file

When an agent or dev is about to edit a file outside their ownership boundary (e.g., shared types,
config files, route definitions), they MUST:

1. Check `.claude/agents/CLAIMS.md` for existing claims
2. If unclaimed → add a claim entry before starting work
3. If already claimed → **STOP** and work on a different task instead

Claims file format (`CLAIMS.md`):
```
| File | Claimed by | Task | Since |
|------|-----------|------|-------|
| shared/types/order.ts | agent-api | TASK-012 | 2026-03-31 |
| frontend/src/app/router.tsx | dev-an | TASK-015 | 2026-03-31 |
```

Release claims: remove the row when your PR is merged or task is done.

## Conflict detection — before committing

Before each commit, check if any of YOUR changed files are also changed on another active branch:
```bash
# List files you changed
git diff --name-only HEAD

# Check if any other branch also changed these files (vs main)
git fetch origin
for branch in $(git branch -r | grep -v main | grep -v HEAD); do
  git diff --name-only origin/main...$branch 2>/dev/null
done | sort | uniq -d
```

If overlap detected:
- **Low priority task** → yield — switch to a different task, come back later
- **High priority task** → coordinate with the other dev/agent (comment on PR or update CLAIMS.md)
- **Shared types overlap** → agent-api always wins — other agents rebase after agent-api merges

## PR workflow for team

- PR title: `[TASK-XXX] Description`
- PR must pass: biome lint + typecheck + tests + runtime verification
- Reviewer: at least 1 human dev (AI agents can review via `/review` but human approval required)
- Merge strategy: squash merge to main, delete branch after merge
- After merge: all other active branches rebase from main before continuing

## Communication protocol

- Agent files (`.claude/agents/[name].md`) serve as async status boards
- Each agent updates "Working on" and "Blocked by" fields in real-time
- Before starting a task, check other agents' status to avoid parallel work on dependent tasks
- If blocked by another agent/dev: update your status, switch to an independent task
