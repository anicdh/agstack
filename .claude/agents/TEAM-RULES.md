# Team Mode Rules

> These rules apply when `Team Mode = team` in CLAUDE.md.
> READ this file at the start of each sprint (during `/plan-sprint`).
> Solo mode ignores this file entirely.

## How multi-dev Standard Mode works

Each dev runs their own Claude session with their own AI agents. All devs work on
the SAME sprint, each assigned a **non-overlapping set of tasks**. Every task is
one feature branch, one PR — all PRs target the **sprint branch**, not main.

```
main (protected, always clean)
└── sprint/sprint-05 (integration branch — QA happens here)
    ├── feat/TASK-021-user-api        (Dev An / agent-api)
    ├── feat/TASK-022-user-service    (Dev An / agent-api)
    ├── feat/TASK-025-user-page       (Dev An / agent-frontend)
    ├── feat/TASK-023-billing-api     (Dev Minh / agent-api)
    ├── feat/TASK-026-billing-page    (Dev Minh / agent-frontend)
    └── feat/TASK-027-billing-form    (Dev Minh / agent-frontend)
```

Each dev's agents run sequentially within their task list (agent-api first, then
agent-frontend), but the two devs work in parallel on different tasks.

## Branch strategy

```
main ─────────────────────────────────────── main (clean, CI builds from here)
  └── sprint/sprint-XX ──── QA + fix ── PR ──┘ (manual merge after QA passes)
        ├── feat/TASK-001 ── PR ──┘
        ├── feat/TASK-002 ── PR ──┘
        └── feat/TASK-003 ── PR ──┘
```

1. **Sprint start** → create `sprint/sprint-XX` from `main`
2. **Each task** → create `feat/TASK-XXX-[desc]` from `sprint/sprint-XX`
3. **Task done** → PR from `feat/TASK-XXX` → `sprint/sprint-XX` (squash merge)
4. **Sprint done** → `/qa` + `/design-review` on `sprint/sprint-XX`
5. **QA passes** → manual PR from `sprint/sprint-XX` → `main` (merge commit, preserves history)
6. **QA fails** → fix on sprint branch, re-run QA, then merge to main

**Why this is safer:**
- `main` never receives unverified code — CI/CD always builds from clean state
- QA runs on the full integrated sprint before touching main
- If sprint is abandoned mid-way, main is unaffected

## Task assignment rules

During `/plan-sprint`, tasks are assigned to devs using these rules:

1. **Group by dependency chain** — if TASK-B depends on TASK-A, same dev gets both
2. **Group by domain** — tasks touching the same module go to the same dev
3. **Balance points** — roughly equal pts per dev (±3 pts variance OK)
4. **Shared types ownership** — if 2 devs both need new shared types, coordinate:
   - Dev A creates the types first → merges PR to sprint branch → Dev B rebases
   - Or: 1 dev owns ALL shared type tasks for the sprint

**Anti-pattern:** Two devs both creating API endpoints that touch the same Prisma
model. Instead, group all tasks for that model under one dev.

## Merge order protocol

All PRs target `sprint/sprint-XX` (NOT main). Order still matters within the sprint branch:

1. **API-first rule** — PRs that create shared types or Prisma migrations merge BEFORE
   PRs that consume them. This is enforced per-dev AND cross-dev.
2. **No merge queue blocking** — if your PR is ready but blocked by another dev's API PR,
   work on your next independent task while waiting
3. **Rebase before merge** — always `git pull --rebase origin sprint/sprint-XX` before pushing
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

Release claims: remove the row when your PR is merged to sprint branch.
Stale claims (>3 days): can be released by anyone after notifying the original dev.

## Conflict detection — before committing

Before each commit, check if any of YOUR changed files overlap with another dev's active branches:
```bash
# List files you changed
git diff --name-only HEAD

# Check overlap with other active branches (vs sprint branch)
SPRINT_BRANCH="sprint/sprint-XX"  # replace XX
git fetch origin
for branch in $(git branch -r | grep feat/ | grep -v "$(git branch --show-current)"); do
  overlap=$(git diff --name-only origin/$SPRINT_BRANCH...$branch 2>/dev/null | grep -xF "$(git diff --name-only HEAD)")
  [ -n "$overlap" ] && echo "OVERLAP with $branch: $overlap"
done
```

If overlap detected:
- Check CLAIMS.md — claimed file wins
- If unclaimed — first PR to merge wins, other dev rebases

## Sync points

Devs should sync at these moments:

1. **Sprint start** — review task assignments, confirm no overlap
2. **After each PR merge to sprint branch** — notify other devs, they rebase from sprint branch
3. **Before starting a task that depends on another dev's work** — confirm their PR is merged
4. **Sprint end QA** — all devs verify integration on sprint branch together

Communication channel: team chat, PR comments, or agent file status boards.

## PR workflow

### Task PRs (feat → sprint branch)
- PR title: `[TASK-XXX] Description`
- Target: `sprint/sprint-XX`
- Must pass: biome lint + typecheck + tests + runtime verification
- Reviewer: at least 1 OTHER dev (not the author). AI agents can pre-review via `/review`
- Merge strategy: squash merge, delete feature branch after merge

### Sprint PR (sprint branch → main)
- PR title: `Sprint XX: [Sprint Goal]`
- Target: `main`
- Must pass: `/qa` (full integration) + `/design-review` (compare vs mockups)
- Reviewer: all participating devs approve
- Merge strategy: merge commit (preserves sprint history)
- This is the ONLY way code reaches main

## Agent file as status board

Each dev updates their agents' status in `.claude/agents/[agent-name].md`:
- "Working on" → current task ID
- "Blocked by" → what's blocking (e.g., "waiting for dev-minh TASK-023 to merge")
- "Done" → list of completed tasks this sprint

This helps other devs know what's in flight without interrupting.
