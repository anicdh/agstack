# Go Handlers Gotchas

## 1. Panicking in Handler

**Symptom:** Entire server crashes when user sends bad request.

**Cause:** Not validating input before processing; using `panic()` for control flow.

```go
// ❌ WRONG — will crash server
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    if userID == "" {
        panic("user ID is required")  // Crashes entire server!
    }
}

// ✅ CORRECT — return error response
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    if userID == "" {
        respondError(w, &AppError{
            StatusCode: http.StatusBadRequest,
            Code:       "MISSING_ID",
            Message:    "User ID is required",
        })
        return
    }
}
```

## 2. Handler Calls Database Directly

**Symptom:** Business logic scattered across handlers; hard to test service in isolation.

**Cause:** Not using service layer.

```go
// ❌ WRONG — handler queries DB directly
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    row := c.DB.QueryRow(r.Context(), "SELECT id, email FROM users WHERE id=$1", userID)
    var user User
    row.Scan(&user.ID, &user.Email)
    json.NewEncoder(w).Encode(user)
}

// ✅ CORRECT — handler calls service, service calls DB
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    user, err := c.getUserService().GetUser(r.Context(), userID)
    if err != nil {
        respondError(w, err)
        return
    }
    respondJSON(w, http.StatusOK, map[string]interface{}{"data": user})
}
```

## 3. Ignoring Request Context

**Symptom:** Client disconnects but server keeps processing; timeouts ignored.

**Cause:** Using `context.Background()` instead of `r.Context()`.

```go
// ❌ WRONG — ignores client timeout
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    user, err := c.getUserService().GetUser(context.Background(), userID)  // Wrong!
}

// ✅ CORRECT — uses request context
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    user, err := c.getUserService().GetUser(r.Context(), userID)  // Right!
}
```

## 4. Forgetting to Set Content-Type

**Symptom:** Browser tries to download JSON as file; client sees wrong content type.

**Cause:** Not setting `Content-Type` header before writing response.

```go
// ❌ WRONG — missing Content-Type
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(user)  // Browser thinks it's text!
}

// ✅ CORRECT — set Content-Type first
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(user)
}
```

## 5. Validation Struct Tags Ignored

**Symptom:** Invalid data accepted; server crashes on nil pointer or bad type.

**Cause:** Defining validation tags but not calling validator.

```go
// ❌ WRONG — validation tags defined but not used
type CreateUserRequest struct {
    Email string `json:"email" validate:"required,email"`
    Name  string `json:"name" validate:"required"`
}

func (c *Container) CreateUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    json.NewDecoder(r.Body).Decode(&req)
    // Skip validation — server crashes if Email is ""!
    user, _ := c.createUserService().Create(r.Context(), req)
}

// ✅ CORRECT — validate struct before use
func (c *Container) CreateUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    json.NewDecoder(r.Body).Decode(&req)
    
    if err := c.Validator.Struct(req); err != nil {
        respondError(w, &AppError{
            StatusCode: http.StatusBadRequest,
            Code:       "VALIDATION_ERROR",
            Message:    err.Error(),
        })
        return
    }
    user, err := c.createUserService().Create(r.Context(), req)
    if err != nil {
        respondError(w, err)
        return
    }
    respondJSON(w, http.StatusCreated, map[string]interface{}{"data": user})
}
```

## 6. Body Read Twice

**Symptom:** Middleware reads body; handler gets empty body.

**Cause:** `r.Body` is a stream that can only be read once.

```go
// ❌ WRONG — logging middleware reads body; handler gets nothing
func (c *Container) LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        body, _ := io.ReadAll(r.Body)  // Stream is consumed!
        slog.Info("request", "body", string(body))
        next.ServeHTTP(w, r)  // Handler gets empty body
    })
}

// ✅ CORRECT — reset body after reading
func (c *Container) LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        body, _ := io.ReadAll(r.Body)
        slog.Info("request", "body", string(body))
        r.Body = io.NopCloser(bytes.NewReader(body))  // Reset
        next.ServeHTTP(w, r)
    })
}
```
