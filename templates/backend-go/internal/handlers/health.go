package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type healthResponse struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	DB        string `json:"db"`
}

// Health returns a handler that checks API + database liveness.
// GET /api/v1/health → {"status":"ok","timestamp":"...","db":"ok"}
func Health(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "ok"
		if err := pool.Ping(r.Context()); err != nil {
			dbStatus = "error"
		}

		status := "ok"
		if dbStatus != "ok" {
			status = "degraded"
		}

		resp := healthResponse{
			Status:    status,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			DB:        dbStatus,
		}

		w.Header().Set("Content-Type", "application/json")
		if status != "ok" {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		json.NewEncoder(w).Encode(resp)
	}
}
