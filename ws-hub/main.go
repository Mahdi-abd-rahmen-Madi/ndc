package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func normalizePostgresDSN(raw string) string {
	if strings.HasPrefix(raw, "postgis://") {
		return "postgres://" + strings.TrimPrefix(raw, "postgis://")
	}
	return raw
}

func main() {
	listenAddr := envOr("LISTEN_ADDR", ":8081")
	dbURL := normalizePostgresDSN(envOr("DATABASE_URL", ""))
	hubSecret := envOr("WS_HUB_SECRET", "")
	workerBase := strings.TrimRight(envOr("ROBOT_WORKER_URL", "http://100.97.172.27:8001"), "/")
	workerStatusURL := envOr("ROBOT_WORKER_STATUS_URL", workerBase+"/api/status")
	allowedOrigins := envOr("ALLOWED_ORIGINS", "")

	var pool *pgxpool.Pool
	if dbURL != "" {
		cfg, err := pgxpool.ParseConfig(dbURL)
		if err != nil {
			log.Fatalf("invalid DATABASE_URL: %v", err)
		}
		cfg.MaxConns = 4
		cfg.MinConns = 1
		cfg.MaxConnLifetime = 30 * time.Minute

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		pool, err = pgxpool.NewWithConfig(ctx, cfg)
		cancel()
		if err != nil {
			log.Fatalf("failed to connect pgxpool: %v", err)
		}
		defer pool.Close()
		log.Printf("ws-hub connected to PostgreSQL (max_conns=%d)", cfg.MaxConns)
	} else {
		log.Printf("WARNING: DATABASE_URL unset; ws-hub auth queries will deny connections")
	}

	hub := NewHub()
	auth := NewAuthStore(pool, allowedOrigins)
	workerStore := NewWorkerStatusStore(workerStatusURL)
	srv := NewServer(hub, auth, workerStore, hubSecret)

	httpServer := &http.Server{
		Addr:              listenAddr,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("ws-hub listening on %s", listenAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(ctx)
	log.Printf("ws-hub stopped cleanly")
}
