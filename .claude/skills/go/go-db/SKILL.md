---
name: go-db
description: >
  Use when writing database queries, migrations, or transactions with pgx.
  Covers PostgreSQL connection pooling, parameterized queries, migrations,
  transactions, and row scanning patterns.
  Assumes you've read go-dev/ first.
invocation: auto
---

# Go Database (pgx) Patterns

> **Prerequisite:** Read `go-dev/SKILL.md` first. This skill assumes you understand error handling and DI.

## Connection Pool Setup

Set up the pool once in `main()` and pass to services.

```go
// In internal/storage/db.go
type DB struct {
    pool *pgxpool.Pool
}

// NewDB creates a new database instance with connection pool
func NewDB(dsn string) (*DB, error) {
    config, err := pgxpool.ParseConfig(dsn)
    if err != nil {
        return nil, fmt.Errorf("parse database config: %w", err)
    }
    
    // Configure pool
    config.MaxConns = 25
    config.MinConns = 5
    config.MaxConnLifetime = 5 * time.Minute
    config.MaxConnIdleTime = 2 * time.Minute
    
    pool, err := pgxpool.NewWithConfig(context.Background(), config)
    if err != nil {
        return nil, fmt.Errorf("create database pool: %w", err)
    }
    
    // Test connection
    if err := pool.Ping(context.Background()); err != nil {
        return nil, fmt.Errorf("ping database: %w", err)
    }
    
    return &DB{pool: pool}, nil
}

// Close closes the connection pool
func (db *DB) Close() {
    db.pool.Close()
}

// In cmd/server/main.go
func main() {
    cfg := loadConfig()
    
    db, err := storage.NewDB(cfg.DatabaseURL)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()
    
    // Pass db to services
    container := NewContainer(cfg, db)
    // ...
}
```

## Query Patterns

Always use parameterized queries (`$1`, `$2`, etc.) — NEVER string interpolation.

```go
// ✅ CORRECT — parameterized query
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    var user User
    err := db.pool.QueryRow(ctx,
        "SELECT id, email, name, created_at FROM users WHERE id=$1",
        id,
    ).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt)
    
    if err == pgx.ErrNoRows {
        return nil, fmt.Errorf("user not found: %w", err)
    }
    if err != nil {
        return nil, fmt.Errorf("query user: %w", err)
    }
    return &user, nil
}

// ❌ WRONG — string interpolation (SQL injection!)
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    sql := fmt.Sprintf("SELECT id, email FROM users WHERE id='%s'", id)  // DANGEROUS!
    // ...
}

// ❌ WRONG — no context passed
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    var user User
    err := db.pool.QueryRow(context.Background(), "SELECT ...").Scan(...)  // Ignores timeout
}
```

## Scanning Rows

```go
// Single row
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    var user User
    err := db.pool.QueryRow(ctx,
        "SELECT id, email FROM users WHERE id=$1",
        id,
    ).Scan(&user.ID, &user.Email)
    
    if err == pgx.ErrNoRows {
        return nil, fmt.Errorf("user %s not found: %w", id, err)
    }
    if err != nil {
        return nil, fmt.Errorf("query user: %w", err)
    }
    return &user, nil
}

// Multiple rows
func (db *DB) ListUsers(ctx context.Context, limit, offset int) ([]*User, error) {
    rows, err := db.pool.Query(ctx,
        "SELECT id, email FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        limit,
        offset,
    )
    if err != nil {
        return nil, fmt.Errorf("query users: %w", err)
    }
    defer rows.Close()
    
    var users []*User
    for rows.Next() {
        var user User
        if err := rows.Scan(&user.ID, &user.Email); err != nil {
            return nil, fmt.Errorf("scan user: %w", err)
        }
        users = append(users, &user)
    }
    
    if err := rows.Err(); err != nil {
        return nil, fmt.Errorf("rows error: %w", err)
    }
    
    return users, nil
}
```

## Inserts and Updates

```go
// Insert single row
func (db *DB) CreateUser(ctx context.Context, email, name string) (*User, error) {
    user := &User{
        ID:        uuid.New().String(),
        Email:     email,
        Name:      name,
        CreatedAt: time.Now(),
    }
    
    _, err := db.pool.Exec(ctx,
        "INSERT INTO users (id, email, name, created_at) VALUES ($1, $2, $3, $4)",
        user.ID, user.Email, user.Name, user.CreatedAt,
    )
    if err != nil {
        return nil, fmt.Errorf("insert user: %w", err)
    }
    return user, nil
}

// Insert with RETURNING clause
func (db *DB) CreateUserWithID(ctx context.Context, email, name string) (*User, error) {
    user := &User{
        Email:     email,
        Name:      name,
        CreatedAt: time.Now(),
    }
    
    err := db.pool.QueryRow(ctx,
        "INSERT INTO users (email, name, created_at) VALUES ($1, $2, $3) RETURNING id",
        email, name, time.Now(),
    ).Scan(&user.ID)
    
    if err != nil {
        return nil, fmt.Errorf("insert user: %w", err)
    }
    return user, nil
}

// Update row
func (db *DB) UpdateUser(ctx context.Context, id, email, name string) error {
    tag, err := db.pool.Exec(ctx,
        "UPDATE users SET email=$1, name=$2, updated_at=NOW() WHERE id=$3",
        email, name, id,
    )
    if err != nil {
        return fmt.Errorf("update user: %w", err)
    }
    
    if tag.RowsAffected() == 0 {
        return fmt.Errorf("user %s not found", id)
    }
    return nil
}

// Delete row
func (db *DB) DeleteUser(ctx context.Context, id string) error {
    tag, err := db.pool.Exec(ctx, "DELETE FROM users WHERE id=$1", id)
    if err != nil {
        return fmt.Errorf("delete user: %w", err)
    }
    if tag.RowsAffected() == 0 {
        return fmt.Errorf("user %s not found", id)
    }
    return nil
}
```

## Transactions

Use transactions for multi-step operations that must succeed or fail together.

```go
// ✅ CORRECT — transaction with rollback on error
func (db *DB) TransferMoney(ctx context.Context, fromID, toID string, amount int) error {
    // Start transaction
    tx, err := db.pool.Begin(ctx)
    if err != nil {
        return fmt.Errorf("begin transaction: %w", err)
    }
    defer tx.Rollback(ctx)  // Rollback if error before Commit
    
    // Deduct from source
    _, err = tx.Exec(ctx,
        "UPDATE accounts SET balance = balance - $1 WHERE id=$2",
        amount, fromID,
    )
    if err != nil {
        return fmt.Errorf("deduct from source: %w", err)
    }
    
    // Add to destination
    _, err = tx.Exec(ctx,
        "UPDATE accounts SET balance = balance + $1 WHERE id=$2",
        amount, toID,
    )
    if err != nil {
        return fmt.Errorf("add to destination: %w", err)
    }
    
    // Commit transaction
    if err := tx.Commit(ctx); err != nil {
        return fmt.Errorf("commit transaction: %w", err)
    }
    return nil
}

// ❌ WRONG — no transaction, partial failure risk
func (db *DB) TransferMoney(ctx context.Context, fromID, toID string, amount int) error {
    db.pool.Exec(ctx, "UPDATE accounts SET balance = balance - $1 WHERE id=$2", amount, fromID)
    db.pool.Exec(ctx, "UPDATE accounts SET balance = balance + $1 WHERE id=$2", amount, toID)
    // If second fails, money is lost!
}
```

## Migrations

Migrations should be simple SQL files. Use a tool like `golang-migrate` or manage manually.

```sql
-- migrations/001_init.up.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- migrations/001_init.down.sql
DROP TABLE IF EXISTS users;
```

Run migrations at startup:

```go
import "github.com/golang-migrate/migrate/v4"

func RunMigrations(databaseURL string) error {
    m, err := migrate.New("file://migrations", databaseURL)
    if err != nil {
        return fmt.Errorf("create migrator: %w", err)
    }
    
    if err := m.Up(); err != nil && err != migrate.ErrNoChange {
        return fmt.Errorf("run migrations: %w", err)
    }
    return nil
}

// In main.go
if err := RunMigrations(cfg.DatabaseURL); err != nil {
    log.Fatal(err)
}
```

## Null Handling

Use `sql.Null*` types for nullable columns, or `pgtype.*` for pgx.

```go
type User struct {
    ID    string
    Email string
    Phone sql.NullString  // Can be NULL
    Age   sql.NullInt32   // Can be NULL
}

func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    var user User
    err := db.pool.QueryRow(ctx,
        "SELECT id, email, phone, age FROM users WHERE id=$1",
        id,
    ).Scan(&user.ID, &user.Email, &user.Phone, &user.Age)
    
    if err != nil {
        return nil, fmt.Errorf("query user: %w", err)
    }
    
    // Check if valid
    if user.Phone.Valid {
        // Use user.Phone.String
    }
    
    return &user, nil
}
```

## Implementation Checklist

- [ ] Connection pool created once with min/max conns set
- [ ] All queries use parameters (`$1`, `$2`)
- [ ] Context passed to all queries
- [ ] Errors wrapped with context
- [ ] Transactions used for multi-step operations
- [ ] Rows properly closed after Query()
- [ ] Null columns handled with sql.Null*
- [ ] Migrations organized in `migrations/` folder
- [ ] DB struct has receiver `(db *DB)`
- [ ] Tests use test database or mock

## Before Commit

- [ ] `go fmt`, `go vet`, `golangci-lint` pass
- [ ] All database queries reviewed for SQL injection (no string interpolation)
- [ ] Tests pass with actual database
- [ ] Migrations tested (up and down)
- [ ] Error messages include context
- [ ] No hardcoded connection strings

## Related Skills

- Read `postgres` skill for schema design and SQL best practices
- Read `go-async` for context timeouts in long queries
- Read `go-testing` for database test setup
- See `gotchas.md` for common database mistakes
