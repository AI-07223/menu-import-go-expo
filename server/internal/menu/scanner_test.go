package menu

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func testImage() string {
	var b bytes.Buffer
	png.Encode(&b, image.NewRGBA(image.Rect(0, 0, 2, 2)))
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(b.Bytes())
}
func reply(w http.ResponseWriter, content string) {
	json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": content}}}})
}
func TestMalformedProviderFallsBack(t *testing.T) {
	first := 0
	second := 0
	a := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { first++; reply(w, `{"categories":BROKEN}`) }))
	defer a.Close()
	b := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { second++; reply(w, `{"categories":[]}`) }))
	defer b.Close()
	scanner := Scanner{Client: a.Client(), Providers: []Provider{{URL: a.URL}, {URL: b.URL, Mistral: true}}}
	if _, err := scanner.Scan(context.Background(), testImage()); err != nil {
		t.Fatal(err)
	}
	if first != 1 || second != 1 {
		t.Fatalf("calls %d/%d", first, second)
	}
}
func TestRateLimitRetriesAndPreservesPayload(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Authorization") != "Bearer fake-key" {
			t.Error("missing auth")
		}
		var payload map[string]any
		if json.NewDecoder(r.Body).Decode(&payload) != nil || payload["model"] != "test-model" {
			t.Error("invalid request")
		}
		if calls == 1 {
			w.WriteHeader(429)
			return
		}
		reply(w, `{"categories":[]}`)
	}))
	defer server.Close()
	scanner := Scanner{Client: server.Client(), Providers: []Provider{{URL: server.URL, Key: "fake-key", Model: "test-model"}}, RetryDelay: time.Millisecond}
	if _, err := scanner.Scan(context.Background(), testImage()); err != nil || calls != 2 {
		t.Fatalf("retry: calls=%d error=%v", calls, err)
	}
}
func TestCancellationAndInvalidImageDoNotSend(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls++; w.WriteHeader(500) }))
	defer server.Close()
	scanner := Scanner{Client: server.Client(), Providers: []Provider{{URL: server.URL}}}
	if _, err := scanner.Scan(context.Background(), "data:image/png;base64,bm90LWFuLWltYWdl"); err == nil {
		t.Fatal("invalid image accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := scanner.Scan(ctx, testImage()); err == nil {
		t.Fatal("cancel ignored")
	}
	if calls != 0 {
		t.Fatal("sent invalid/cancelled request")
	}
}
func TestAllProvidersFail(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls++; w.WriteHeader(401) }))
	defer server.Close()
	scanner := Scanner{Client: server.Client(), Providers: []Provider{{URL: server.URL}, {URL: server.URL}}}
	if _, err := scanner.Scan(context.Background(), testImage()); err == nil || calls != 2 {
		t.Fatalf("all failures: %d %v", calls, err)
	}
}
