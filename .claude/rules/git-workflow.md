# Git Workflow

## Commit Messages
Format: `type(scope): description`

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code refactoring
- docs: Documentation
- test: Tests
- chore: Maintenance

## Before Commit
- Run `cargo fmt`
- Run `cargo clippy`
- Run `cargo test`
- Review diff

## GitNexus Integration (MANDATORY)

**BEFORE COMMIT, MUST follow order:**

1. Run `npx gitnexus analyze` to update index
2. Stage AGENTS.md and CLAUDE.md along with code changes
3. Commit everything in 1 commit

**Reason:** GitNexus stats are embedded in AGENTS.md/CLAUDE.md.
If you commit code first then analyze later, these 2 files will be in uncommitted state.

**Commit flow:**
```bash
# Step 1: Update GitNexus index (updates AGENTS.md, CLAUDE.md)
npx gitnexus analyze

# Step 2: Stage all changes including GitNexus files
git add <your-files> AGENTS.md CLAUDE.md

# Step 3: Commit
git commit -m "type(scope): description"
```

**One-liner (if you want to stage everything):**
```bash
npx gitnexus analyze && git add -A && git commit -m "type(scope): description"
```

## Never Commit
- Secrets, API keys
- .env files
- Large binaries
- Build artifacts
