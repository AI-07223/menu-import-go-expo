package menu

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"strconv"
	"strings"
)

type rawVariant struct {
	Name  *string         `json:"name"`
	Price json.RawMessage `json:"price"`
}
type rawItem struct {
	Name       *string         `json:"name"`
	Price      json.RawMessage `json:"price"`
	Vegetarian json.RawMessage `json:"is_veg"`
	Variations []rawVariant    `json:"variations"`
}
type rawCategory struct {
	Name  *string    `json:"name"`
	Items *[]rawItem `json:"items"`
}

var decimal = regexp.MustCompile(`^[0-9]{1,5}(\.[0-9]{1,2})?$`)

// ParseMinor preserves meaning: no stripping minus signs, currency symbols or punctuation.
func ParseMinor(raw json.RawMessage) *int32 {
	text := strings.TrimSpace(string(raw))
	if strings.HasPrefix(text, `"`) {
		if json.Unmarshal(raw, &text) != nil {
			return nil
		}
		text = strings.TrimSpace(text)
	}
	if !decimal.MatchString(text) {
		return nil
	}
	parts := strings.SplitN(text, ".", 2)
	whole, _ := strconv.Atoi(parts[0])
	fraction := 0
	if len(parts) == 2 {
		v := parts[1]
		if len(v) == 1 {
			v += "0"
		}
		fraction, _ = strconv.Atoi(v)
	}
	n := int32(whole*100 + fraction)
	return &n
}
func dietary(raw json.RawMessage) *bool {
	text := strings.ToLower(strings.TrimSpace(string(raw)))
	if strings.HasPrefix(text, `"`) {
		var s string
		if json.Unmarshal(raw, &s) != nil {
			return nil
		}
		text = strings.ToLower(strings.TrimSpace(s))
	}
	if text != "true" && text != "false" {
		return nil
	}
	value := text == "true"
	return &value
}
func Normalize(text string) (Draft, error) {
	result := Draft{Currency: "UNKNOWN", Items: []Item{}}
	// Tolerate a single Markdown code fence, but not arbitrary surrounding text.
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "```json") && strings.HasSuffix(text, "```") {
		text = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(text, "```json"), "```"))
	}
	var response struct {
		Currency   string         `json:"currency"`
		Categories *[]rawCategory `json:"categories"`
	}
	decoder := json.NewDecoder(bytes.NewBufferString(text))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&response); err != nil {
		return result, errors.New("invalid model JSON or schema")
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF || response.Categories == nil || len(*response.Categories) > 100 {
		return result, errors.New("invalid model categories")
	}
	if response.Currency == "INR" || response.Currency == "USD" {
		result.Currency = response.Currency
	}
	for _, category := range *response.Categories {
		if category.Name == nil || category.Items == nil || len(*category.Items) > 100 {
			return result, errors.New("invalid model category")
		}
		group := strings.TrimSpace(*category.Name)
		if group == "" {
			group = "Menu"
		}
		if len(group) > 120 {
			return result, errors.New("category name too long")
		}
		for _, raw := range *category.Items {
			if raw.Name == nil || strings.TrimSpace(*raw.Name) == "" || len(*raw.Name) > 255 || len(raw.Variations) > 20 {
				return result, errors.New("invalid model dish")
			}
			item := Item{Category: group, Name: strings.TrimSpace(*raw.Name), PriceMinor: ParseMinor(raw.Price), Vegetarian: dietary(raw.Vegetarian), Variants: []Variant{}}
			for _, v := range raw.Variations {
				if v.Name == nil || strings.TrimSpace(*v.Name) == "" || len(*v.Name) > 120 {
					return result, errors.New("invalid model portion")
				}
				item.Variants = append(item.Variants, Variant{Name: strings.TrimSpace(*v.Name), PriceMinor: ParseMinor(v.Price)})
			}
			result.Items = append(result.Items, item)
			if len(result.Items) > 100 {
				return result, errors.New("too many model dishes")
			}
		}
	}
	return result, nil
}
