package api

import (
	"bytes"
	"context"
	"encoding/json"
	"menu-review/internal/menu"
	"net/http"
	"net/http/httptest"
	"testing"
)

type memoryStore struct{ calls int }

func (m *memoryStore) Save(_ context.Context, name string, d menu.Draft) (menu.Saved, error) {
	m.calls++
	return menu.Saved{ID: "one", Name: name, Currency: d.Currency, Items: d.Items}, nil
}
func (m *memoryStore) List(context.Context) ([]menu.Saved, error) { return []menu.Saved{}, nil }

const testToken = "test-operator-token-at-least-24-chars"

func call(t *testing.T, h http.Handler, query string, variables map[string]any, token string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"query": query, "variables": variables})
	r := httptest.NewRequest("POST", "/graphql", bytes.NewReader(body))
	r.Header.Set("X-Review-Token", token)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}
func TestAuthenticationAndDemo(t *testing.T) {
	store := &memoryStore{}
	h := Handler(&Resolver{Store: store}, testToken)
	if w := call(t, h, `{ demoDraft { currency } }`, nil, ""); w.Code != 401 {
		t.Fatal("missing token accepted")
	}
	w := call(t, h, `{ demoDraft { currency items { name priceMinor vegetarian variants { name } } } }`, nil, testToken)
	if w.Code != 200 || !bytes.Contains(w.Body.Bytes(), []byte("Paneer Tikka")) || bytes.Contains(w.Body.Bytes(), []byte(`"errors"`)) {
		t.Fatal(w.Body.String())
	}
	if store.calls != 0 {
		t.Fatal("demo wrote data")
	}
}
func TestGraphQLRejectsUnknownDietaryBeforeStore(t *testing.T) {
	store := &memoryStore{}
	h := Handler(&Resolver{Store: store}, testToken)
	input := map[string]any{"name": "Menu", "currency": "INR", "items": []any{map[string]any{"name": "Rice", "category": "Food", "priceMinor": 5000, "vegetarian": nil, "variants": []any{}}}}
	query := `mutation Save($input: ReviewedMenuInput!){saveMenu(input:$input){id}}`
	w := call(t, h, query, map[string]any{"input": input}, testToken)
	if !bytes.Contains(w.Body.Bytes(), []byte("dietary")) || store.calls != 0 {
		t.Fatal(w.Body.String())
	}
	input["items"].([]any)[0].(map[string]any)["vegetarian"] = false
	w = call(t, h, query, map[string]any{"input": input}, testToken)
	if bytes.Contains(w.Body.Bytes(), []byte(`"errors"`)) || store.calls != 1 {
		t.Fatal(w.Body.String())
	}
}
