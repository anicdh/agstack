# Contributing to agStack

Thanks for your interest in contributing! This guide will help you get started.

## How to Contribute

### Reporting Bugs

Open an issue with a clear description, steps to reproduce, and expected vs actual behavior. Include your environment (OS, Node version, Rust version, Claude Code version).

### Suggesting Features

Open an issue with the "feature request" label. Describe the use case and why it would benefit agStack users.

### Submitting Code

1. Fork the repository
2. Create a feature branch from `main`: `git checkout -b feature/your-feature`
3. Make your changes following the coding conventions below
4. Test your changes
5. Commit using [conventional commits](https://www.conventionalcommits.org/): `type(scope): description`
6. Push and open a Pull Request

## Coding Conventions

This project enforces strict coding standards. Please read `CLAUDE.md` for the full guide. The key rules:

- **Biome** for linting and formatting — run `npx @biomejs/biome check --write .` before committing
- **Conventional commits** — `type(scope): description` (max 72 chars)
- **TypeScript strict mode** — no `any`, no unchecked casts
- **Rust Clippy pedantic** — `cargo clippy -- -D warnings`
- Functions under 50 lines, files under 300 lines
- No TODO/FIXME in PRs to main — create a backlog item instead

## What Not to Change

- `frontend/src/components/ui/` — these are Shadcn-managed files. Create wrappers in `components/shared/` instead
- Migration files after they've been committed
- `CLAUDE.md` — propose changes via PR with explanation

## Development Setup

```bash
cp .env.example .env
docker-compose up -d
cd frontend && npm install && npm run dev
cd api && npm install && npx prisma migrate dev && npm run start:dev
cd jobs && cargo build && cargo run
```

## Code of Conduct

Be respectful, constructive, and inclusive. We're all here to build something useful.

## Questions?

Open a discussion or reach out in issues. No question is too small.
