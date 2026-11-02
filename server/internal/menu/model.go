package menu

import (
	"errors"
	"fmt"
	"strings"
)

type Variant struct {
	Name       string `json:"name"`
	PriceMinor *int32 `json:"priceMinor"`
}
type Item struct {
	Category   string    `json:"category"`
	Name       string    `json:"name"`
	PriceMinor *int32    `json:"priceMinor"`
	Vegetarian *bool     `json:"vegetarian"`
	Variants   []Variant `json:"variants"`
}
type Draft struct {
	Currency string `json:"currency"`
	Items    []Item `json:"items"`
}
type Saved struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Currency string `json:"currency"`
	Items    []Item `json:"items"`
}

func Validate(name string, d Draft) error {
	if strings.TrimSpace(name) == "" || len(name) > 120 {
		return errors.New("menu name must contain 1–120 bytes")
	}
	if d.Currency != "INR" {
		return errors.New("this sample supports INR only")
	}
	if len(d.Items) == 0 || len(d.Items) > 100 {
		return errors.New("review between 1 and 100 dishes")
	}
	for i, item := range d.Items {
		if strings.TrimSpace(item.Name) == "" || len(item.Name) > 255 || strings.TrimSpace(item.Category) == "" || len(item.Category) > 120 {
			return fmt.Errorf("dish %d needs a valid name and category", i+1)
		}
		if item.Vegetarian == nil {
			return fmt.Errorf("choose a dietary classification for dish %d", i+1)
		}
		if item.PriceMinor == nil || *item.PriceMinor <= 0 || *item.PriceMinor > 9999999 {
			return fmt.Errorf("review the price of dish %d", i+1)
		}
		if len(item.Variants) > 20 {
			return errors.New("too many portion variants")
		}
		for _, v := range item.Variants {
			if strings.TrimSpace(v.Name) == "" || len(v.Name) > 120 || v.PriceMinor == nil || *v.PriceMinor <= 0 || *v.PriceMinor > 9999999 {
				return fmt.Errorf("review every portion name and price for dish %d", i+1)
			}
		}
	}
	return nil
}
