# TODOs

## Deferred

### Orchestrator script for automated wave execution (v2)
- **What:** Bash/node script that reads sprint plan, creates worktrees, spawns agents, waits for completion, auto-merges wave by wave.
- **Why:** Manual wave triggers work but add friction. Full automation would let users run a single command for the entire sprint.
- **Pros:** One-command sprint execution. True automation.
- **Cons:** Script maintenance (~200 lines), couples to Claude CLI interface, shell portability.
- **Context:** Approach B from the design doc. Deferred until wave-based workflow is validated in real sprints. Design doc: `~/.gstack/projects/anicdh-agstack/andoan-main-design-20260410-144030.md`.
- **Depends on:** Wave-based worktree orchestration shipped and tested in at least 1 real sprint.
