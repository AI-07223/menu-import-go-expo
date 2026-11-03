package menu

import (
	"encoding/json"
	"testing"
)

func TestPriceMeaning(t *testing.T) {
	for _, bad := range []string{`-50`, `"Rs 50"`, `"1.234"`, `"1e3"`, `null`, `true`, `100000`, `"1.2.3"`} {
		if ParseMinor(json.RawMessage(bad)) != nil {
			t.Errorf("accepted %s", bad)
		}
	}
	for input, want := range map[string]int32{`"10.10"`: 1010, `0.29`: 29, `"99.9"`: 9990, `0`: 0} {
		got := ParseMinor(json.RawMessage(input))
		if got == nil || *got != want {
			t.Errorf("%s -> %v", input, got)
		}
	}
}
func TestUncertaintyAndPortions(t *testing.T) {
	d, err := Normalize(`{"categories":[{"name":"Food","items":[{"name":"Chicken","price":"-50","is_veg":"false","variations":[{"name":"Half","price":"10.10"}]},{"name":"Unknown","price":20}]}]}`)
	if err != nil {
		t.Fatal(err)
	}
	if d.Items[0].Vegetarian == nil || *d.Items[0].Vegetarian || d.Items[0].PriceMinor != nil || d.Items[1].Vegetarian != nil || *d.Items[0].Variants[0].PriceMinor != 1010 {
		t.Fatalf("lost meaning: %+v", d)
	}
}
func TestInvalidStructureFailsButEmptyIsValid(t *testing.T) {
	for _, bad := range []string{`{}`, `{"categories":null}`, `{"categories":"bad"}`, `{"categories":[{"name":"Food"}]}`, `{"categories":[]} {"categories":[]}`, `{"categories":[{"name":"Food","items":[{}]}]}`} {
		if _, err := Normalize(bad); err == nil {
			t.Errorf("accepted %s", bad)
		}
	}
	if d, err := Normalize(`{"categories":[]}`); err != nil || len(d.Items) != 0 {
		t.Fatal("valid empty result rejected")
	}
}
func TestSaveValidationRejectsUnresolvedAndInvalidVariants(t *testing.T) {
	price := int32(1010)
	flag := false
	d := Draft{Currency: "INR", Items: []Item{{Category: "Food", Name: "Chicken", PriceMinor: &price, Vegetarian: &flag, Variants: []Variant{}}}}
	if err := Validate("Menu", d); err != nil {
		t.Fatal(err)
	}
	d.Items[0].Vegetarian = nil
	if Validate("Menu", d) != nil {
		t.Fatal("unknown dietary value should be accepted")
	}
	d.Items[0].Vegetarian = &flag
	d.Items[0].Variants = []Variant{{Name: "Half"}}
	if Validate("Menu", d) == nil {
		t.Fatal("unpriced portion saved")
	}
}

func TestConfidenceDoesNotDiscardDish(t *testing.T) {
	for _, tc := range []struct {
		raw  string
		want int32
	}{{"0", 0}, {"99", 99}, {"101", -1}, {"-1", -1}, {"null", -1}, {"0.8", -1}} {
		draft, err := Normalize(`{"categories":[{"name":"Food","items":[{"name":"Rice","price":5,"confidence":` + tc.raw + `}]}]}`)
		if err != nil || len(draft.Items) != 1 {
			t.Fatal("lost dish", err)
		}
		got := draft.Items[0].Confidence
		if (tc.want < 0 && got != nil) || (tc.want >= 0 && (got == nil || *got != tc.want)) {
			t.Errorf("unexpected confidence for %s", tc.raw)
		}
	}
}
