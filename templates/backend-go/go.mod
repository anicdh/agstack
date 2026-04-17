module __PROJECT_NAME__

go 1.22

require (
	github.com/go-chi/chi/v5 v5.1.0
	github.com/jackc/pgx/v5 v5.7.1
)

// NOTE: go.sum is NOT shipped in the template.
// After /setup copies this folder, run `go mod tidy` to generate it.
