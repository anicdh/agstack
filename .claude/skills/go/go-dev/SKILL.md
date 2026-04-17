---
name: go-dev
description: >
  ALWAYS read this BEFORE writing or modifying any Go code (.go files).
  Covers core standards: project structure, naming conventions, error handling,
  dependency injection, and file organization for the Go backend.
  MANDATORY first reading for agent-api-go on every feature.
invocation: auto
---

# Go Development Standards

> **MANDATORY:** Read this file before writing ANY `.go` code in the project.

## Project Structure

```
backend-go/
├── cmd/
│   └── server/
│       └── main.go              # Entry point: config, DI, server start
├── internal/
│   ├── app.go                   # Container type (all deps)
│   ├── config.go                # LoadConfig() from env
│   ├── errors.go                # AppError struct + helpers
│   ├── handlers/
│   │   ├── handlers.go          # RegisterRoutes(container, router)
│   │   ├── users.go             # Handler methods (receiver: *Container)
│   │   ├── orders.go
│   │   └── _test.go
│   ├── services/
│   │   ├── users.go             # Business logic (receiver: *Service)
│   │   ├── orders.go
│   │   └── _test.go
│   ├── storage/
│   │   ├── db.go                # DB pool, query builders
│   │   ├── users.go             # DB methods (receiver: *DB)
│   │   ├── orders.go
│   │   └── _test.go
│   ├── middleware/
│   │   ├── logging.go
│   │   ├── auth.go
│   │   └── _test.go
│   └── doc.go                   # Package comment
├── migrations/
│   ├── 001_init.up.sql
│   └── 001_init.down.sql
├── go.mod
└── Makefile
```

**Key rules:**
- `cmd/` — ONLY `main()`, server startup, graceful shutdown
- `internal/` — ALL application code, unexported to outside modules
- `handlers/` — HTTP request/response, call services
- `services/` — Business logic, call storage
- `storage/` — Database queries ONLY
- One file per resource: `handlers/users.go`, `services/users.go`, `storage/users.go`

## Naming Conventions

| Context | Rule | Example |
|---------|------|---------|
| **Exported functions** | PascalCase | `GetUser()`, `CreateOrder()` |
| **Unexported functions** | camelCase | `validateEmail()`, `buildQuery()` |
| **Exported types** | PascalCase | `User`, `CreateUserRequest` |
| **Unexported types** | camelCase (rare) | `userCache` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| **Receivers** | Single letter or abbreviation | `func (c *Container)`, `func (s *Service)`, `func (db *DB)` |
| **Context var** | Always `ctx` | `func (c *Container) GetUser(ctx context.Context, id string)` |
| **Error var** | Always `err` | `if err != nil { return err }` |
| **Writer/Request** | `w` and `r` | `func (c *Container) Handler(w http.ResponseWriter, r *http.Request)` |
| **Loop vars** | Short, meaningful | `for i, user := range users` |

## Error Handling

### Rule: Always Wrap Errors with Context

```go
// ✅ CORRECT — wrap with context
user, err := db.GetUser(ctx, id)
if err != nil {
    return nil, fmt.Errorf("get user %s: %w", id, err)
}

// ✅ CORRECT — wrap at each layer
ordersDB, err := s.db.GetOrders(ctx, userID)
if err != nil {
    return nil, fmt.Errorf("fetch orders for user %s: %w", userID, err)
}

// ❌ WRONG — naked return
if err != nil {
    return err  // caller doesn't know what failed
}

// ❌ WRONG — error lost
rows, _ := db.Query(ctx, sql)  // silently ignoring error
```

### AppError for API Responses

```go
// Define in internal/errors.go
type AppError struct {
    StatusCode int    // HTTP status code
    Code       string // Machine-readable code (e.g., "USER_NOT_FOUND")
    Message    string // Human-readable message
    Err        error  // Original error (nil is OK)
}

func (e *AppError) Error() string { return e.Message }
func (e *AppError) Unwrap() error { return e.Err }

// Usage in service
if user == nil {
    return nil, &AppError{
        StatusCode: http.StatusNotFound,
        Code:       "USER_NOT_FOUND",
        Message:    "User does not exist",
    }
}

// Middleware converts to JSON response
if appErr, ok := err.(*AppError); ok {
    w.WriteHeader(appErr.StatusCode)
    json.NewEncoder(w).Encode(map[string]string{
        "code":    appErr.Code,
        "message": appErr.Message,
    })
}
```

## Dependency Injection

### Rule: Constructor Pattern Only

```go
// ✅ CORRECT — wire in main.go
type Container struct {
    DB     *pgxpool.Pool
    Logger *slog.Logger
    Config *Config
}

// New constructor
func NewContainer(cfg *Config, db *pgxpool.Pool) *Container {
    return &Container{
        DB:     db,
        Logger: slog.Default(),
        Config: cfg,
    }
}

// Handlers receive container
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    // use c.DB, c.Logger, c.Config
}

// In main.go:
// 1. Load config
cfg := loadConfig()

// 2. Create DB pool
db, err := pgxpool.New(ctx, cfg.DatabaseURL)
if err != nil {
    log.Fatal(err)
}

// 3. Create container with all deps
container := NewContainer(cfg, db)

// 4. Register routes
router := chi.NewRouter()
container.RegisterRoutes(router)

// ❌ WRONG — globals
var GlobalDB *pgxpool.Pool

func init() {
    var err error
    GlobalDB, err = pgxpool.New(context.Background(), "...")
    if err != nil {
        panic(err)  // Can't test, can't inject mocks
    }
}
```

## Documentation Comments

Every exported function, type, and constant MUST have a doc comment.

```go
// ✅ CORRECT
// GetUser retrieves a user by ID from the database.
// Returns ErrNotFound if the user doesn't exist.
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    // ...
}

// User represents a user in the system.
type User struct {
    ID    string `json:"id"`
    Email string `json:"email"`
}

// ❌ WRONG — missing comment
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    // ...
}

// ❌ WRONG — unclear comment
// Gets user
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
```

## Logging

Only use `log/slog` (Go's stdlib structured logger).

```go
// ✅ CORRECT
logger := slog.Default()
logger.Info("user created", "user_id", userID, "email", email)
logger.Error("database error", "error", err, "query", "SELECT ...")

// ❌ WRONG
fmt.Println("User created")
log.Printf("User %s created", userID)
logger.Info(fmt.Sprintf("user created: %s", userID))  // loses structure
```

## Context Propagation

Always pass `context.Context` as the first argument. Never ignore it.

```go
// ✅ CORRECT — context first, propagated through layers
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()  // Get from request
    user, err := c.GetUserService().GetUser(ctx, id)
}

func (s *Service) GetUser(ctx context.Context, id string) (*User, error) {
    return s.db.GetUser(ctx, id)  // Pass down
}

func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    // Use for query timeout, cancellation
    return db.pool.QueryRow(ctx, "SELECT * FROM users WHERE id=$1", id).Scan(&user)
}

// ❌ WRONG
func GetUser(id string) (*User, error) {  // Missing ctx
    return db.GetUser(context.Background(), id)
}

// ❌ WRONG
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    // Ignoring context, no timeout
    return db.pool.QueryRow(context.Background(), "SELECT ...").Scan(&user)
}
```

## Panic Policy

```go
// ✅ Only in main() for unrecoverable startup failures
func main() {
    cfg := loadConfig()
    if cfg == nil {
        panic("failed to load config")  // OK in main
    }
}

// ❌ NEVER in handlers or services
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")
    if id == "" {
        panic("id is empty")  // WRONG: crash the server
        // Instead: return error, middleware handles it
    }
}
```

## Implementation Checklist

### Every New Function

- [ ] Has doc comment
- [ ] Context as first arg (if async/DB)
- [ ] Error as last return value
- [ ] All errors wrapped: `fmt.Errorf("context: %w", err)`
- [ ] No naked returns (always explicit)
- [ ] No `panic()` except main
- [ ] Has test coverage

### Every New Type

- [ ] Has doc comment
- [ ] JSON tags on exported fields: `json:"fieldName"`
- [ ] Validation tags if used in request: `validate:"required,email"`
- [ ] Receiver methods export if public, unexport if private

### Every New Package

- [ ] Has package doc comment in `doc.go` or first file
- [ ] Only exports what's needed
- [ ] Has `_test.go` file with at least 1 test

## Before Committing

```bash
# 1. Format
go fmt ./...

# 2. Vet (static analysis)
go vet ./...

# 3. Lint (if golangci-lint configured)
golangci-lint run

# 4. Run tests
go test ./... -v

# 5. Race detection
go test ./... -race

# 6. Check for unexported funcs without doc
go doc ./internal/... | grep "^type\|^func" | grep "^func [a-z]"

# 7. Verify no secrets
git diff --staged | grep -iE "password|secret|api_key|token"
```

## Anti-Patterns — NEVER Do

| Anti-pattern | Fix |
|-------------|-----|
| `panic()` in handler | Return error, middleware handles |
| String interpolation in SQL | Always use `$1`, `$2`, etc. |
| Bare `go func()` (no error handling) | Use `errgroup` |
| Global state vars | Constructor injection |
| `interface{}` without type guard | Use concrete types or generics |
| Ignoring `context.Context` | Always propagate |
| `init()` with side effects | Explicit setup in `main()` |
| Exporting from `internal/` | Keep API surface small |
| `log.Fatal` in library code | Return error to caller |
| `time.Sleep` for coordination | Use channels, sync.Cond |

## Related Skills

- Read `go-handlers` for HTTP patterns
- Read `go-db` for database patterns
- Read `go-async` for goroutines, errgroup, context timeouts
- Read `go-testing` for test patterns
- See `gotchas.md` for common mistakes
