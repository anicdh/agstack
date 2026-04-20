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
- Review diff
- NestJS profiles: `cd frontend && npx tsc --noEmit` + `cd api && npx tsc --noEmit`
- nestjs-rust profile only: `cargo fmt` + `cargo clippy` + `cargo test`
- go-only profile: `go vet ./...` + `go test ./...`
- python-only profile: `ruff check .` + `pytest`
- All profiles: `npx @biomejs/biome check --write .`

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
