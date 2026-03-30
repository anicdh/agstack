# gStack + Agile — Quick Reference

## Sprint Cycle (2 weeks)

```
DAY 1 — PLANNING
  /office-hours         → Define epics/tasks for sprint
  /plan-ceo-review      → Validate priorities
  /plan-eng-review      → Estimate, spot risks
  Create SPRINT.md      → cp agile/templates/sprint.md agile/sprints/sprint-XX/
  Assign agents         → Update .claude/agents/*.md

DAILY — DEV LOOP
  merge-status.sh       → Automated standup
  Code on branch        → feat/[task-name]
  /review               → Code review (smart routing)
  /qa                   → Browser test
  /ship                 → Test + PR
  Update SPRINT.md      → Status ⬜ → 🔵 → ✅

LAST DAY -1 — REVIEW
  /qa (full suite)      → Regression test
  /design-review        → UI/UX check
  /cso                  → Security audit
  /document-release     → Sync all docs

LAST DAY — RETRO
  /retro                → Summarize sprint
  /benchmark            → Performance compare
  Update VELOCITY.md    → Track velocity
  Close sprint          → git commit "chore: close sprint XX"
```

## File Ownership (who edits what)

```
CLAUDE.md              → Lead only (via PR)
.claude/agents/*.md    → Each agent (own file)
agile/BACKLOG.md       → PO/Lead
agile/sprints/XX/*     → Lead creates, agents update status
ARCHITECTURE.md        → Lead (via PR)
CHANGELOG.md           → CI / /document-release
README.md              → CI / /document-release
Source code            → Each agent on feature branch
```

## Task Anatomy (Epic → Task, no Story)

```markdown
### TASK-XXX: [title] [N pts] [status]
- **Agent:** [who]
- **Branch:** feat/[name]
- **Accept when:**
  - [ ] [criterion 1]
  - [ ] [criterion 2]
- **Tech:** [approach]
- **Depends on:** [task IDs]
```

## gStack Commands Cheat Sheet

```
PLANNING:     /office-hours  /plan-ceo-review  /plan-eng-review  /autoplan
DEVELOPING:   /review  /ship  /qa  /qa-only  /careful
REVIEWING:    /design-review  /design-consultation  /cso
DEPLOYING:    /land-and-deploy  /canary  /setup-deploy
MAINTAINING:  /retro  /benchmark  /investigate  /document-release
PROTECTING:   /freeze  /guard  /unfreeze
BROWSING:     /browse
UPGRADING:    /gstack-upgrade
```
