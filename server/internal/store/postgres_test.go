package store

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"menu-review/internal/menu"
	"os"
	"strings"
	"sync"
	"testing"
)

func TestPostgresPersistenceAndRollback(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL unset; use docker compose test for real PostgreSQL")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if !strings.HasSuffix(pool.Config().ConnConfig.Database, "_test") {
		t.Fatal("integration tests require a database ending _test")
	}
	repo := &Postgres{pool}
	if err := repo.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "TRUNCATE menus CASCADE"); err != nil {
		t.Fatal(err)
	}
	price := int32(1010)
	flag := false
	d := menu.Draft{Currency: "INR", Items: []menu.Item{{Name: "Chicken", Category: "Food", PriceMinor: &price, Vegetarian: &flag, Variants: []menu.Variant{{Name: "Half", PriceMinor: &price}}}}}
	saved, err := repo.Save(ctx, "Dinner", d)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := repo.List(ctx)
	if err != nil || len(rows) != 1 || rows[0].ID != saved.ID || *rows[0].Items[0].PriceMinor != 1010 || *rows[0].Items[0].Vegetarian || len(rows[0].Items[0].Variants) != 1 {
		t.Fatalf("roundtrip: %+v %v", rows, err)
	}
	// An unknown classification is preserved rather than guessed.
	unknown := d
	unknown.Items = append([]menu.Item(nil), d.Items...)
	unknown.Items[0].Vegetarian = nil
	stored, err := repo.Save(ctx, "Unknown dietary", unknown)
	if err != nil {
		t.Fatal(err)
	}
	rows, err = repo.List(ctx)
	if err != nil || rows[0].ID != stored.ID || rows[0].Items[0].Vegetarian != nil {
		t.Fatal("unknown dietary value not preserved")
	}
	if _, err = pool.Exec(ctx, "DELETE FROM menus WHERE id=$1", stored.ID); err != nil {
		t.Fatal(err)
	}
	// The second dish violates the real database uniqueness constraint after the
	// menu and first dish have been inserted. The entire new menu must roll back.
	d.Items = append(d.Items, d.Items[0])
	if _, err := repo.Save(ctx, "Should roll back", d); err == nil {
		t.Fatal("expected database constraint failure")
	}
	rows, err = repo.List(ctx)
	if err != nil || len(rows) != 1 {
		t.Fatal("partial menu escaped rollback")
	}
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM menu_items").Scan(&count); err != nil || count != 1 {
		t.Fatal("partial dish escaped rollback")
	}
}

// Concurrent startups must not race while applying the shared schema.
func TestConcurrentMigrate(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL unset")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if !strings.HasSuffix(pool.Config().ConnConfig.Database, "_test") {
		t.Fatal("integration tests require a database ending _test")
	}
	repo := &Postgres{pool}
	var group sync.WaitGroup
	errors := make(chan error, 4)
	for range 4 {
		group.Add(1)
		go func() { defer group.Done(); errors <- repo.Migrate(ctx) }()
	}
	group.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Errorf("concurrent migration: %v", err)
		}
	}
}
