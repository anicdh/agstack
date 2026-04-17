---
name: go-handlers
description: >
  Use when writing HTTP handlers, middleware, routes, or response helpers.
  Covers Chi router patterns, request validation, response marshaling, error handling,
  and middleware chains for the Go backend.
  Assumes you've read go-dev/ first.
invocation: auto
---

# Go HTTP Handlers & Middleware

> **Prerequisite:** Read `go-dev/SKILL.md` first. This skill assumes you understand project structure and error handling.

## Handler Structure

Handlers are thin: validate input, call service, write response. All business logic goes in `services/`.

```go
// ✅ CORRECT — thin handler
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    
    // 1. Extract input
    userID := chi.URLParam(r, "id")
    if userID == "" {
        respondError(w, &AppError{
            StatusCode: http.StatusBadRequest,
            Code:       "INVALID_ID",
            Message:    "User ID is required",
        })
        return
    }
    
    // 2. Call service (business logic)
    user, err := c.getUserService().GetUser(ctx, userID)
    if err != nil {
        respondError(w, err)
        return
    }
    
    // 3. Return response
    respondJSON(w, http.StatusOK, map[string]interface{}{
        "data": user,
    })
}

// ❌ WRONG — thick handler with business logic
func (c *Container) GetUser(w http.ResponseWriter, r *http.Request) {
    userID := chi.URLParam(r, "id")
    
    // Query database directly (belongs in service)
    row := c.DB.QueryRow(context.Background(), "SELECT id, email FROM users WHERE id=$1", userID)
    var user User
    if err := row.Scan(&user.ID, &user.Email); err != nil {
        // Handle error
    }
    
    // Custom business logic (belongs in service)
    if user.Email == "" {
        // ...
    }
    
    json.NewEncoder(w).Encode(user)
}
```

## Request Types (Input Validation)

Define request structs with validation tags. Validate in handler before calling service.

```go
// In internal/handlers/users.go
type CreateUserRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
    Name     string `json:"name" validate:"required,max=100"`
}

type ListUsersQuery struct {
    Page  int    `json:"page" validate:"min=1"`
    Limit int    `json:"limit" validate:"min=1,max=100"`
    Sort  string `json:"sort" validate:"omitempty,oneof=name email created_at"`
}

// Handler validates
func (c *Container) CreateUser(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, &AppError{
            StatusCode: http.StatusBadRequest,
            Code:       "INVALID_JSON",
            Message:    "Invalid request body",
            Err:        err,
        })
        return
    }
    
    // Validate
    if err := c.Validator.Struct(req); err != nil {
        respondError(w, &AppError{
            StatusCode: http.StatusBadRequest,
            Code:       "VALIDATION_ERROR",
            Message:    "Validation failed: " + err.Error(),
        })
        return
    }
    
    // Call service
    user, err := c.getUserService().CreateUser(ctx, req)
    if err != nil {
        respondError(w, err)
        return
    }
    
    respondJSON(w, http.StatusCreated, map[string]interface{}{
        "data": user,
    })
}
```

## Response Helpers

Write response helpers to marshal JSON consistently.

```go
// In internal/handlers/handlers.go
type BaseResponse struct {
    Data  interface{} `json:"data,omitempty"`
    Error *ErrorMeta  `json:"error,omitempty"`
    Meta  *PaginationMeta `json:"meta,omitempty"`
}

type ErrorMeta struct {
    Code    string `json:"code"`
    Message string `json:"message"`
}

type PaginationMeta struct {
    Page  int `json:"page"`
    Limit int `json:"limit"`
    Total int `json:"total"`
}

// respondJSON writes a successful response
func respondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    json.NewEncoder(w).Encode(BaseResponse{Data: data})
}

// respondError writes an error response
func respondError(w http.ResponseWriter, err error) {
    statusCode := http.StatusInternalServerError
    code := "INTERNAL_ERROR"
    message := "An error occurred"
    
    // Check if AppError
    if appErr, ok := err.(*AppError); ok {
        statusCode = appErr.StatusCode
        code = appErr.Code
        message = appErr.Message
    }
    
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    json.NewEncoder(w).Encode(BaseResponse{
        Error: &ErrorMeta{
            Code:    code,
            Message: message,
        },
    })
}

// respondPaginated writes paginated response
func respondPaginated(w http.ResponseWriter, data interface{}, page, limit, total int) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(BaseResponse{
        Data: data,
        Meta: &PaginationMeta{
            Page:  page,
            Limit: limit,
            Total: total,
        },
    })
}
```

## Route Registration

Register all routes in one place. Use method receivers on Container.

```go
// In internal/handlers/handlers.go
func (c *Container) RegisterRoutes(router *chi.Mux) {
    // Public routes
    router.Route("/api/v1", func(r chi.Router) {
        // Users
        r.Route("/users", func(r chi.Router) {
            r.Post("/", c.CreateUser)           // POST /api/v1/users
            r.Get("/", c.ListUsers)             // GET /api/v1/users
            r.Get("/{id}", c.GetUser)           // GET /api/v1/users/{id}
            r.Patch("/{id}", c.UpdateUser)      // PATCH /api/v1/users/{id}
            r.Delete("/{id}", c.DeleteUser)     // DELETE /api/v1/users/{id}
        })
        
        // Orders
        r.Route("/orders", func(r chi.Router) {
            r.Post("/", c.CreateOrder)
            r.Get("/", c.ListOrders)
            r.Get("/{id}", c.GetOrder)
        })
    })
    
    // Protected routes (behind auth middleware)
    router.Route("/api/v1", func(r chi.Router) {
        r.Use(c.AuthMiddleware)  // Apply auth to this group
        r.Post("/users/{id}/avatar", c.UploadUserAvatar)
    })
}
```

## Middleware

Middleware wraps handlers. Apply globally or to specific routes.

```go
// In internal/middleware/logging.go
func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        
        // Wrap ResponseWriter to capture status code
        wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
        
        next.ServeHTTP(wrapped, r)
        
        // Log after handler completes
        duration := time.Since(start).Milliseconds()
        logger := slog.Default()
        logger.Info("http request",
            "method", r.Method,
            "path", r.URL.Path,
            "status", wrapped.statusCode,
            "duration_ms", duration,
        )
    })
}

// Helper to capture status code
type responseWriter struct {
    http.ResponseWriter
    statusCode int
}

func (w *responseWriter) WriteHeader(code int) {
    w.statusCode = code
    w.ResponseWriter.WriteHeader(code)
}

// In internal/middleware/auth.go
func (c *Container) AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Extract token from Authorization header
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            respondError(w, &AppError{
                StatusCode: http.StatusUnauthorized,
                Code:       "MISSING_AUTH",
                Message:    "Missing Authorization header",
            })
            return
        }
        
        // Validate token
        userID, err := c.validateToken(authHeader)
        if err != nil {
            respondError(w, &AppError{
                StatusCode: http.StatusUnauthorized,
                Code:       "INVALID_TOKEN",
                Message:    "Invalid or expired token",
            })
            return
        }
        
        // Add userID to context
        ctx := context.WithValue(r.Context(), "userID", userID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Register middleware in main.go
router := chi.NewRouter()
router.Use(c.LoggingMiddleware)  // Global middleware
router.Use(chi.Middleware.RequestID)
router.Use(chi.Middleware.StripSlashes)

// Auth middleware on specific routes (see RegisterRoutes above)
```

## Extracting Input from Request

```go
// URL parameter
userID := chi.URLParam(r, "id")

// Query parameter
page := r.URL.Query().Get("page")  // String
pageInt, _ := strconv.Atoi(page)   // Convert to int

// JSON body
var req CreateUserRequest
json.NewDecoder(r.Body).Decode(&req)

// Form data
r.ParseForm()
email := r.FormValue("email")

// Custom context value
userID := r.Context().Value("userID").(string)
```

## Implementation Checklist

- [ ] Handler is thin (< 20 lines, no business logic)
- [ ] Validates input before calling service
- [ ] Calls service, not database
- [ ] Uses response helpers (respondJSON, respondError)
- [ ] Returns AppError for client errors
- [ ] Extracts context correctly: `ctx := r.Context()`
- [ ] Returns appropriate HTTP status code
- [ ] Tests cover happy path + error cases
- [ ] No `panic()` in handler
- [ ] Middleware applied to correct routes
- [ ] No global middleware applied unnecessarily

## Before Commit

- [ ] All routes registered in `RegisterRoutes()`
- [ ] All handlers have receiver: `(c *Container)`
- [ ] All request structs have validation tags
- [ ] Error responses use `AppError`
- [ ] Tests with `httptest.Server`
- [ ] Lint: `go fmt`, `go vet`, `golangci-lint`

## Related Skills

- Read `go-db` for database queries called from services
- Read `go-testing` for httptest patterns
- See `gotchas.md` for common handler mistakes
