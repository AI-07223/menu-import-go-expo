package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"menu-review/internal/api"
	"menu-review/internal/menu"
	"menu-review/internal/store"
)

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
func main() {
	token := os.Getenv("OPERATOR_TOKEN")
	if len(token) < 24 {
		slog.Error("OPERATOR_TOKEN must contain at least 24 characters")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		slog.Error("database configuration failed")
		os.Exit(1)
	}
	defer pool.Close()
	database := &store.Postgres{Pool: pool}
	err = database.Migrate(ctx)
	cancel()
	if err != nil {
		slog.Error("database migration failed")
		os.Exit(1)
	}
	scanner := &menu.Scanner{Client: &http.Client{Timeout: 12 * time.Second}, RetryDelay: 300 * time.Millisecond}
	if key := os.Getenv("OPENROUTER_API_KEY"); key != "" {
		scanner.Providers = append(scanner.Providers, menu.Provider{URL: "https://openrouter.ai/api/v1/chat/completions", Key: key, Model: env("OPENROUTER_MODEL", "google/gemini-2.5-flash-lite")})
	}

	mux := http.NewServeMux()
	mux.Handle("/graphql", api.Handler(&api.Resolver{Scanner: scanner, Store: database}, token))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if pool.Ping(ctx) != nil {
			http.Error(w, "unavailable", 503)
			return
		}
		w.Write([]byte("ok"))
	})
	mux.Handle("/", http.FileServer(http.Dir(env("STATIC_DIR", "web"))))
	server := &http.Server{Addr: ":" + env("PORT", "8080"), Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 50 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-shutdown
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()
	slog.Info("menu review ready", "address", server.Addr, "liveProviders", len(scanner.Providers))
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("HTTP server stopped")
		os.Exit(1)
	}
}
