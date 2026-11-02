package api

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	_ "embed"
	"encoding/json"
	"errors"
	graphql "github.com/graph-gophers/graphql-go"
	"menu-review/internal/menu"
	"net/http"
	"time"
)

//go:embed schema.graphql
var schemaText string

//go:embed demo.json
var demoJSON string

type Repository interface {
	Save(context.Context, string, menu.Draft) (menu.Saved, error)
	List(context.Context) ([]menu.Saved, error)
}
type Resolver struct {
	Scanner *menu.Scanner
	Store   Repository
}
type variantInput struct {
	Name       string
	PriceMinor *int32
}
type itemInput struct {
	Category, Name string
	PriceMinor     *int32
	Vegetarian     *bool
	Variants       []variantInput
}
type reviewedInput struct {
	Name, Currency string
	Items          []itemInput
}
type savedResolver struct{ value menu.Saved }

func (s *savedResolver) ID() graphql.ID     { return graphql.ID(s.value.ID) }
func (s *savedResolver) Name() string       { return s.value.Name }
func (s *savedResolver) Currency() string   { return s.value.Currency }
func (s *savedResolver) Items() []menu.Item { return s.value.Items }
func (r *Resolver) DemoDraft() (*menu.Draft, error) {
	draft, err := menu.Normalize(demoJSON)
	return &draft, err
}
func (r *Resolver) ScanMenu(ctx context.Context, args struct{ Image string }) (*menu.Draft, error) {
	draft, err := r.Scanner.Scan(ctx, args.Image)
	return &draft, err
}
func (r *Resolver) Menus(ctx context.Context) ([]*savedResolver, error) {
	entries, err := r.Store.List(ctx)
	if err != nil {
		return nil, errors.New("saved menus are temporarily unavailable")
	}
	out := []*savedResolver{}
	for _, entry := range entries {
		out = append(out, &savedResolver{entry})
	}
	return out, nil
}
func (r *Resolver) SaveMenu(ctx context.Context, args struct{ Input reviewedInput }) (*savedResolver, error) {
	d := menu.Draft{Currency: args.Input.Currency, Items: []menu.Item{}}
	for _, v := range args.Input.Items {
		item := menu.Item{Category: v.Category, Name: v.Name, PriceMinor: v.PriceMinor, Vegetarian: v.Vegetarian, Variants: []menu.Variant{}}
		for _, variant := range v.Variants {
			item.Variants = append(item.Variants, menu.Variant{Name: variant.Name, PriceMinor: variant.PriceMinor})
		}
		d.Items = append(d.Items, item)
	}
	if err := menu.Validate(args.Input.Name, d); err != nil {
		return nil, err
	}
	result, err := r.Store.Save(ctx, args.Input.Name, d)
	if err != nil {
		return nil, errors.New("save failed; check duplicate dish names or try again")
	}
	return &savedResolver{result}, nil
}

// Single-operator sample. The header is separate from Cloud Run's IAM bearer token.
func Handler(r *Resolver, token string) http.Handler {
	schema := graphql.MustParseSchema(schemaText, r, graphql.UseFieldResolvers(), graphql.MaxDepth(8), graphql.MaxParallelism(4))
	expected := sha256.Sum256([]byte(token))
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if req.Method != http.MethodPost {
			w.Header().Set("Allow", "POST")
			http.Error(w, "POST required", 405)
			return
		}
		actual := sha256.Sum256([]byte(req.Header.Get("X-Review-Token")))
		if len(token) < 24 || subtle.ConstantTimeCompare(expected[:], actual[:]) != 1 {
			http.Error(w, "operator token required", 401)
			return
		}
		req.Body = http.MaxBytesReader(w, req.Body, 6*1024*1024)
		var input struct {
			Query         string         `json:"query"`
			Variables     map[string]any `json:"variables"`
			OperationName string         `json:"operationName"`
		}
		if err := json.NewDecoder(req.Body).Decode(&input); err != nil || len(input.Query) > 12000 {
			http.Error(w, "invalid or oversized GraphQL request", 400)
			return
		}
		ctx, cancel := context.WithTimeout(req.Context(), 45*time.Second)
		defer cancel()
		response := schema.Exec(ctx, input.Query, input.OperationName, input.Variables)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})
}
