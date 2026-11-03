package store

import (
	"context"
	"crypto/rand"
	_ "embed"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"menu-review/internal/menu"
	"strings"
)

//go:embed schema.sql
var schema string

type Postgres struct{ Pool *pgxpool.Pool }

// Migrate serializes startup schema changes across app instances.
func (p *Postgres) Migrate(ctx context.Context) error {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(69456201)"); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, schema); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (p *Postgres) Save(ctx context.Context, name string, d menu.Draft) (menu.Saved, error) {
	if err := menu.Validate(name, d); err != nil {
		return menu.Saved{}, err
	}
	id := fmt.Sprintf("%x-%x-%x-%x-%x", randomBytes(4), randomBytes(2), randomBytes(2), randomBytes(2), randomBytes(6))
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return menu.Saved{}, err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, "INSERT INTO menus(id,name,currency) VALUES($1,$2,$3)", id, strings.TrimSpace(name), d.Currency); err != nil {
		return menu.Saved{}, err
	}
	for i, item := range d.Items {
		variants := item.Variants
		if variants == nil {
			variants = []menu.Variant{}
		}
		encoded, e := json.Marshal(variants)
		if e != nil {
			return menu.Saved{}, e
		}
		_, err = tx.Exec(ctx, "INSERT INTO menu_items(menu_id,position,category,name,price_minor,vegetarian,variants,photo) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", id, i, strings.TrimSpace(item.Category), strings.TrimSpace(item.Name), *item.PriceMinor, item.Vegetarian, encoded, item.Photo)
		if err != nil {
			return menu.Saved{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return menu.Saved{}, err
	}
	return menu.Saved{ID: id, Name: strings.TrimSpace(name), Currency: d.Currency, Items: d.Items}, nil
}
func randomBytes(n int) []byte {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return b
}
func (p *Postgres) List(ctx context.Context) ([]menu.Saved, error) {
	rows, err := p.Pool.Query(ctx, `SELECT m.id::text,m.name,m.currency,COALESCE(jsonb_agg(jsonb_build_object('category',i.category,'name',i.name,'priceMinor',i.price_minor,'vegetarian',i.vegetarian,'photo',i.photo,'variants',i.variants) ORDER BY i.position) FILTER(WHERE i.menu_id IS NOT NULL),'[]'::jsonb) FROM (SELECT * FROM menus ORDER BY created_at DESC,id DESC LIMIT 20) m LEFT JOIN menu_items i ON i.menu_id=m.id GROUP BY m.id,m.name,m.currency,m.created_at ORDER BY m.created_at DESC,m.id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []menu.Saved{}
	for rows.Next() {
		var saved menu.Saved
		var raw []byte
		if err := rows.Scan(&saved.ID, &saved.Name, &saved.Currency, &raw); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &saved.Items); err != nil {
			return nil, err
		}
		result = append(result, saved)
	}
	return result, rows.Err()
}
