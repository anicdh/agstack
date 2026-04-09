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

## GitNexus Integration (If Available)

If GitNexus is initialized (`npx gitnexus status` returns index info), update the
index before committing so AGENTS.md/CLAUDE.md stay in sync:

```bash
# Step 1: Update GitNexus index (updates AGENTS.md, CLAUDE.md)
npx gitnexus analyze

# Step 2: Stage all changes including GitNexus files
git add <your-files> AGENTS.md CLAUDE.md

# Step 3: Commit
git commit -m "type(scope): description"
```

**One-liner:**
```bash
npx gitnexus analyze && git add -A && git commit -m "type(scope): description"
```

If GitNexus is NOT initialized, just commit normally — skip the analyze step.

## Never Commit
- Secrets, API keys
- .env files
- Large binaries
- Build artifacts
