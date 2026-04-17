---
name: go
description: >
  Use when writing or modifying any Go code (.go files) in the project.
  Hub skill that routes to specialized sub-skills for core standards, HTTP handlers,
  database access, async patterns, and testing.
  MANDATORY for agent-api-go.
invocation: auto
---

# Go — Skill Hub

Quick reference for all Go sub-skills. Match your task to the right skill.

## Always Start Here

1. **Read `go-dev`** — core standards, error handling, project structure (ALWAYS)
2. **Match your task to a sub-skill below** and **read that skill file**
3. **Follow the skill's checklist before committing**

## Sub-Skills

| Task | Skill to read |
|------|---------------|
| Any .go file (error handling, naming, structure) | `go-dev` |
| HTTP handler, middleware, response helper | `go-handlers` |
| Database query, migration, transaction | `go-db` |
| Goroutines, errgroup, context, channels | `go-async` |
| Unit test, integration test, httptest | `go-testing` |
| WebSocket, real-time, connection management | `go-websocket` |

## Quick Decision Tree

```
Writing Go code?
  ├─ First time in this session? Read go-dev/ ✅
  ├─ HTTP handler, middleware, response? → Read go-handlers/
  ├─ Database query, migration, transaction? → Read go-db/
  ├─ Goroutines, context, channels, shutdown? → Read go-async/
  ├─ Writing tests? → Read go-testing/
  ├─ WebSocket, real-time, pub/sub? → Read go-websocket/
  └─ Stuck? Read gotchas.md
```

## Key Rules (Quick Reference)

| Rule | Details |
|------|---------|
| **Error handling** | Always wrap: `fmt.Errorf("context: %w", err)`. Custom `AppError` for API responses. |
| **Naming** | PascalCase for exported, camelCase for unexported. Short var names `ctx`, `err`, `w`, `r`. |
| **Logging** | Use `slog` (stdlib). Structured fields. No `fmt.Print*`. |
| **DI** | Constructor injection only. No globals. Pass `*Container` or individual deps. |
| **Testing** | Table-driven tests. Use `testing.T`. Prefer `httptest.Server` for integration. |
| **Context** | Pass as first arg to functions. Use `context.Background()` in main. Propagate up. |
| **Linting** | Run `go fmt`, `go vet`, `golangci-lint run` before commit. |

## Before Commit

```bash
# 1. Format and vet
go fmt ./...
go vet ./...

# 2. Run linter
golangci-lint run

# 3. Run all tests
go test ./... -v

# 4. Check for race conditions (integration tests)
go test ./... -race

# 5. Review diff
git diff --stat
```

## Related Skills

- `postgres` — Schema design, migration patterns, SQL best practices
- `typescript` — For API types if integrating with TypeScript frontend

## File Structure

```
backend-go/
├── cmd/
│   └── server/
│       └── main.go              # Entry point
├── internal/
│   ├── app.go                   # Container & setup
│   ├── errors.go                # AppError type
│   ├── handlers/
│   │   ├── handlers.go          # Handler registrations
│   │   ├── users.go             # User handlers
│   │   └── ...
│   ├── services/
│   │   ├── users.go             # User business logic
│   │   └── ...
│   ├── storage/
│   │   ├── db.go                # DB pool & queries
│   │   ├── users.go             # User DB methods
│   │   └── ...
│   ├── middleware/
│   │   ├── logging.go
│   │   ├── auth.go
│   │   └── ...
│   └── config.go                # Config loading
├── migrations/
│   ├── 001_init.up.sql
│   └── 001_init.down.sql
└── go.mod
```

## Dependency Map

| Need | Package | Usage |
|------|---------|-------|
| HTTP routing | `github.com/go-chi/chi/v5` | Router, middleware chains |
| Database | `github.com/jackc/pgx/v5/pgxpool` | Connection pool |
| Logging | `log/slog` | Structured logging (stdlib) |
| Concurrency | `golang.org/x/sync/errgroup` | Goroutine error coordination |
| Validation | `github.com/go-playground/validator/v10` | Struct field validation |
| JSON schema | `encoding/json` | Marshal/unmarshal (stdlib) |
| Context | `context` | Request context (stdlib) |
| HTTP test | `net/http/httptest` | Integration tests (stdlib) |

## Common Patterns

### Error Handling

```go
// ✅ Always wrap with context
if err != nil {
    return fmt.Errorf("failed to fetch user: %w", err)
}

// For API responses, use AppError
type AppError struct {
    StatusCode int
    Code       string
    Message    string
}
```

### DI Container

```go
// ✅ Constructor-based, pass container to handlers
type Container struct {
    DB     *pgxpool.Pool
    Logger *slog.Logger
    // ... other deps
}

func (c *Container) RegisterRoutes(router *chi.Mux) {
    router.Post("/users", c.createUser)
}
```

### Request/Response

```go
// ✅ Use chi response helpers
func (c *Container) getUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    
    var resp struct {
        Data User `json:"data"`
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(resp)
}
```

## Gotchas & Troubleshooting

See `gotchas.md` in this skill folder for common mistakes and fixes.

## Checklist: New Feature

- [ ] Read `go-dev/SKILL.md`
- [ ] Read relevant sub-skill (handlers, db, async, testing)
- [ ] Write handlers in `internal/handlers/`
- [ ] Write services in `internal/services/`
- [ ] Write DB queries in `internal/storage/`
- [ ] Add tests in `*_test.go` files (table-driven)
- [ ] Run linter + tests (see Before Commit above)
- [ ] All errors wrapped with context
- [ ] No globals, only DI via Container
- [ ] Logging uses slog, structured fields
- [ ] No `panic()` except in main

## Checklist: Review

Before submitting PR, verify:

- [ ] `go fmt`, `go vet`, `golangci-lint` all pass
- [ ] All tests pass with `-race` flag
- [ ] No panics except in main
- [ ] Error handling: all errors wrapped
- [ ] Logging: slog only, structured
- [ ] Context passed correctly through call stack
- [ ] No global variables
- [ ] Handlers are thin (call services)
- [ ] Database queries isolated in storage layer
- [ ] Tests cover happy path + error cases
