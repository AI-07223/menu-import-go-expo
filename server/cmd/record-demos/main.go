package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"menu-review/internal/menu"
)

type recording struct {
	Model         string          `json:"model"`
	ReturnedModel string          `json:"returnedModel"`
	ImageHash     string          `json:"imageSha256"`
	At            string          `json:"recordedAt"`
	Raw           string          `json:"raw"`
	Draft         menu.Draft      `json:"draft"`
	Usage         json.RawMessage `json:"usage"`
}

func capture(client *http.Client, key, model, mime string, image []byte) (recording, error) {
	var run recording
	content := []any{map[string]any{"type": "text", "text": menu.Prompt}, map[string]any{"type": "image_url", "image_url": map[string]string{"url": "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(image)}}}
	payload := map[string]any{"model": model, "messages": []any{map[string]any{"role": "user", "content": content}}, "temperature": 0, "max_tokens": 2500, "reasoning": map[string]any{"enabled": false}, "provider": map[string]any{"max_price": map[string]float64{"prompt": 0.15, "completion": 0.6}}}
	body, err := json.Marshal(payload)
	if err != nil {
		return run, err
	}
	req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return run, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := client.Do(req)
	if err != nil {
		return run, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return run, fmt.Errorf("OpenRouter HTTP %d", resp.StatusCode)
	}
	var result struct {
		Model   string
		Usage   json.RawMessage
		Choices []struct {
			Message struct{ Content string }
			Finish  string `json:"finish_reason"`
		}
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(&result); err != nil {
		return run, err
	}
	if len(result.Choices) != 1 || result.Choices[0].Finish != "stop" {
		return run, fmt.Errorf("missing or truncated completion")
	}
	raw := result.Choices[0].Message.Content
	draft, err := menu.Normalize(raw)
	if err != nil {
		return run, err
	}
	return recording{model, result.Model, fmt.Sprintf("%x", sha256.Sum256(image)), time.Now().UTC().Format(time.RFC3339), raw, draft, result.Usage}, nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run() error {
	key := strings.TrimSpace(os.Getenv("OPENROUTER_API_KEY"))
	if key == "" {
		return fmt.Errorf("set OPENROUTER_API_KEY in the recorder environment")
	}
	out := "../client/src/demo-runs.json"
	data, err := os.ReadFile(out)
	if err != nil {
		return err
	}
	var runs map[string]recording
	if err = json.Unmarshal(data, &runs); err != nil {
		return err
	}
	client := &http.Client{Timeout: 75 * time.Second}
	for _, file := range []string{"sample-clear.png", "citrus-window.png", "lunch-edition.jpg"} {
		img, err := os.ReadFile(filepath.Join("../client/assets", file))
		if err != nil {
			return err
		}
		mime := "image/png"
		if strings.HasSuffix(file, ".jpg") {
			mime = "image/jpeg"
		}
		for _, model := range []string{"qwen/qwen3.7-flash", "google/gemini-2.5-flash-lite", "deepseek/deepseek-v4.1-flash"} {
			id := file + "|" + model
			if prev, ok := runs[id]; ok && prev.ImageHash == fmt.Sprintf("%x", sha256.Sum256(img)) {
				continue
			}
			result, err := capture(client, key, model, mime, img)
			if err != nil {
				return fmt.Errorf("%s: %w", id, err)
			}
			runs[id] = result
			data, err = json.MarshalIndent(runs, "", "  ")
			if err != nil {
				return err
			}
			if err = os.WriteFile(out+".tmp", data, 0644); err != nil {
				return err
			}
			if err = os.Rename(out+".tmp", out); err != nil {
				return err
			}
			fmt.Println("Recorded", id, len(result.Draft.Items), "items")
		}
	}
	return nil
}
