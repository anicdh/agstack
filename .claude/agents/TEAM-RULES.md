# Team Mode Rules

> These rules apply when `Team Mode = team` in CLAUDE.md.
> READ this file at the start of each sprint (during `/plan-sprint`).
> Solo mode ignores this file entirely.

## How multi-dev Standard Mode works

Each dev runs their own Claude session with their own AI agents. All devs work on
the SAME sprint, each assigned a **non-overlapping set of tasks**. Every task is
one branch, one PR — no shared branches between devs.

```
Sprint 05 (25 pts)
├── Dev An  (13 pts) ─── agent-api  → TASK-021, TASK-022
│                    └── agent-frontend → TASK-025
├── Dev Minh (12 pts) ── agent-api  → TASK-023
│                     └── agent-frontend → TASK-026, TASK-027
```

Each dev's agents run sequentially within their task list (agent-api first, then
agent-frontend), but the two devs work in parallel on different tasks.

## Task assignment rules

During `/plan-sprint`, tasks are assigned to devs using these rules:

1. **Group by dependency chain** — if TASK-B depends on TASK-A, same dev gets both
2. **Group by domain** — tasks touching the same module go to the same dev
3. **Balance points** — roughly equal pts per dev (±3 pts variance OK)
4. **Shared types ownership** — if 2 devs both need new shared types, coordinate:
   - Dev A creates the types first → merges PR → Dev B rebases and uses them
   - Or: 1 dev owns ALL shared type tasks for the sprint

**Anti-pattern:** Two devs both creating API endpoints that touch the same Prisma
model. Instead, group all tasks for that model under one dev.

## Branch protection

- `main` is protected — no direct push, PR required with at least 1 approval
- Branch naming: `feat/TASK-XXX-[description]` (per task, per dev)
- Merge via PR only — squash merge for clean history
- After merge: all other devs pull main before starting their next task

## Merge order protocol

Because multiple devs merge PRs to main throughout the sprint, order matters:

1. **API-first rule** — PRs that create shared types or Prisma migrations merge BEFORE
   PRs that consume them. This is enforced per-dev AND cross-dev.
2. **No merge queue blocking** — if your PR is ready but blocked by another dev's API PR,
   work on your next independent task while waiting
3. **Rebase before merge** — always `git pull --rebase origin main` before pushing
4. **Conflict resolution** — if merge conflict:
   - On your OWN files → you resolve
   - On shared files → coordinate with the other dev via chat/call
   - On shared types → agent-api owner's version wins

## File claims — before editing a shared file

When a dev or agent is about to edit a file outside their ownership boundary (e.g.,
shared types, config files, route definitions), they MUST:

1. Check `.claude/agents/CLAIMS.md` for existing claims
2. If unclaimed → add a claim entry before starting work
3. If already claimed by another dev → **STOP** and coordinate with that dev

Claims file format (`CLAIMS.md`):
```
| File | Claimed by | Task | Since |
|------|-----------|------|-------|
| shared/types/order.ts | dev-an / agent-api | TASK-021 | 2026-04-02 |
| frontend/src/app/router.tsx | dev-minh / agent-frontend | TASK-026 | 2026-04-02 |
```

Release claims: remove the row when your PR is merged.
Stale claims (>3 days): can be released by anyone after notifying the original dev.

## Conflict detection — before committing

Before each commit, check if any of YOUR changed files overlap with another dev's active branches:
```bash
# List files you changed
git diff --name-only HEAD

# Check overlap with other active branches (vs main)
git fetch origin
for branch in $(git branch -r | grep -v main | grep -v HEAD | grep -v "$(git branch --show-current)"); do
  overlap=$(git diff --name-only origin/main...$branch 2>/dev/null | grep -xF "$(git diff --name-only HEAD)")
  [ -n "$overlap" ] && echo "OVERLAP with $branch: $overlap"
done
```

If overlap detected:
- Check CLAIMS.md — claimed file wins
- If unclaimed — first PR to merge wins, other dev rebases

## Sync points

Devs should sync at these moments:

1. **Sprint start** — review task assignments, confirm no overlap
2. **After each PR merge** — notify other devs: "TASK-XXX merged, shared types updated"
3. **Before starting a task that depends on another dev's work** — confirm their PR is merged
4. **Daily standup (optional)** — quick check: blocked? need to reorder?

Communication channel: team chat, PR comments, or agent file status boards.

## PR workflow for team

- PR title: `[TASK-XXX] Description`
- PR must pass: biome lint + typecheck + tests + runtime verification
- Reviewer: at least 1 OTHER dev (not the author). AI agents can pre-review via `/review`
- Merge strategy: squash merge to main, delete branch after merge
- After merge: notify team, other devs rebase active branches

## Agent file as status board

Each dev updates their agents' status in `.claude/agents/[agent-name].md`:
- "Working on" → current task ID
- "Blocked by" → what's blocking (e.g., "waiting for dev-minh TASK-023 to merge")
- "Done" → list of completed tasks this sprint

This helps other devs know what's in flight without interrupting.
