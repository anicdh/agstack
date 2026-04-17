# Go Database Gotchas

## 1. SQL Injection via String Interpolation

**Symptom:** Application crashes or behaves unexpectedly with special characters in input; security vulnerability.

**Cause:** Using `fmt.Sprintf()` or concatenation to build SQL instead of parameters.

```go
// ❌ DANGEROUS — SQL injection vulnerability
func (db *DB) GetUser(ctx context.Context, email string) (*User, error) {
    sql := fmt.Sprintf("SELECT id, email FROM users WHERE email='%s'", email)
    // If email = "admin'--", query becomes: SELECT ... WHERE email='admin'--'
    var user User
    err := db.pool.QueryRow(ctx, sql).Scan(&user.ID, &user.Email)
    // ...
}

// ✅ CORRECT — parameterized query
func (db *DB) GetUser(ctx context.Context, email string) (*User, error) {
    var user User
    err := db.pool.QueryRow(ctx,
        "SELECT id, email FROM users WHERE email=$1",
        email,  // Parameter, not interpolated
    ).Scan(&user.ID, &user.Email)
    // ...
}
```

## 2. Rows Not Closed

**Symptom:** Connection pool exhausted; "too many open connections" errors; memory leak.

**Cause:** Forgetting `defer rows.Close()` after `Query()`.

```go
// ❌ WRONG — rows not closed, connection leaked
func (db *DB) ListUsers(ctx context.Context) ([]*User, error) {
    rows, err := db.pool.Query(ctx, "SELECT id, email FROM users")
    if err != nil {
        return nil, err
    }
    // Forgot defer rows.Close()!
    
    var users []*User
    for rows.Next() {
        var user User
        rows.Scan(&user.ID, &user.Email)
        users = append(users, &user)
    }
    return users, nil  // Connection still open
}

// ✅ CORRECT — rows closed immediately
func (db *DB) ListUsers(ctx context.Context) ([]*User, error) {
    rows, err := db.pool.Query(ctx, "SELECT id, email FROM users")
    if err != nil {
        return nil, err
    }
    defer rows.Close()  // Always close!
    
    var users []*User
    for rows.Next() {
        var user User
        rows.Scan(&user.ID, &user.Email)
        users = append(users, &user)
    }
    return users, nil
}
```

## 3. Ignoring Context Timeout in Query

**Symptom:** Slow query hangs forever; client timeout ignored; server unresponsive.

**Cause:** Using `context.Background()` instead of query context.

```go
// ❌ WRONG — ignores context timeout
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    // ctx might have 5s timeout, but we ignore it!
    var user User
    err := db.pool.QueryRow(context.Background(),  // WRONG!
        "SELECT id, email FROM users WHERE id=$1",
        id,
    ).Scan(&user.ID, &user.Email)
    // ...
}

// ✅ CORRECT — respects context timeout
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    var user User
    err := db.pool.QueryRow(ctx,  // Use passed context
        "SELECT id, email FROM users WHERE id=$1",
        id,
    ).Scan(&user.ID, &user.Email)
    // ...
}
```

## 4. Transaction Not Committed

**Symptom:** Changes don't persist; data inconsistency; operation succeeds but data not saved.

**Cause:** Forgetting `tx.Commit()` or returning early without committing.

```go
// ❌ WRONG — changes never committed
func (db *DB) TransferMoney(ctx context.Context, from, to string, amount int) error {
    tx, _ := db.pool.Begin(ctx)
    defer tx.Rollback(ctx)
    
    tx.Exec(ctx, "UPDATE accounts SET balance = balance - $1 WHERE id=$2", amount, from)
    tx.Exec(ctx, "UPDATE accounts SET balance = balance + $1 WHERE id=$2", amount, to)
    
    // Forgot to commit! Changes are rolled back on defer.
    return nil
}

// ✅ CORRECT — changes committed before defer
func (db *DB) TransferMoney(ctx context.Context, from, to string, amount int) error {
    tx, err := db.pool.Begin(ctx)
    if err != nil {
        return fmt.Errorf("begin transaction: %w", err)
    }
    defer tx.Rollback(ctx)
    
    _, err = tx.Exec(ctx, "UPDATE accounts SET balance = balance - $1 WHERE id=$2", amount, from)
    if err != nil {
        return fmt.Errorf("deduct: %w", err)
    }
    
    _, err = tx.Exec(ctx, "UPDATE accounts SET balance = balance + $1 WHERE id=$2", amount, to)
    if err != nil {
        return fmt.Errorf("add: %w", err)
    }
    
    if err := tx.Commit(ctx); err != nil {  // Explicitly commit
        return fmt.Errorf("commit: %w", err)
    }
    return nil
}
```

## 5. Scanning Into Wrong Type

**Symptom:** Runtime panic; data corruption; incorrect values.

**Cause:** Mismatched types in Scan() — string into int, or vice versa.

```go
// ❌ WRONG — type mismatch in Scan
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    var user User
    err := db.pool.QueryRow(ctx,
        "SELECT id, email, age FROM users WHERE id=$1",
        id,
    ).Scan(&user.ID, &user.Email, &user.Email)  // Age scanned as string!
    // Panics at runtime if age column is integer
}

// ✅ CORRECT — types match columns
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    var user User
    err := db.pool.QueryRow(ctx,
        "SELECT id, email, age FROM users WHERE id=$1",
        id,
    ).Scan(&user.ID, &user.Email, &user.Age)  // Types match!
}
```

## 6. No Rows Error Ignored

**Symptom:** Function returns nil instead of error; handler doesn't know record was not found.

**Cause:** Checking error too broadly without checking for pgx.ErrNoRows.

```go
// ❌ WRONG — ErrNoRows treated same as query error
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    var user User
    err := db.pool.QueryRow(ctx, "SELECT id, email FROM users WHERE id=$1", id).Scan(&user.ID, &user.Email)
    if err != nil {
        return nil, err  // Same error for "not found" vs "network error"
    }
    return &user, nil
}

// ✅ CORRECT — distinguish not found from other errors
func (db *DB) GetUser(ctx context.Context, id string) (*User, error) {
    var user User
    err := db.pool.QueryRow(ctx, "SELECT id, email FROM users WHERE id=$1", id).Scan(&user.ID, &user.Email)
    if err == pgx.ErrNoRows {
        return nil, &AppError{
            StatusCode: http.StatusNotFound,
            Code:       "USER_NOT_FOUND",
            Message:    "User does not exist",
        }
    }
    if err != nil {
        return nil, fmt.Errorf("query user: %w", err)
    }
    return &user, nil
}
```
