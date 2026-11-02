import { test } from "node:test";
import assert from "node:assert/strict";
import {
	parsePrice,
	priceText,
	editDraft,
	reviewedItems,
	issues,
} from "../src/menu.ts";
test("prices use exact minor units and reject ambiguous input", () => {
	assert.equal(parsePrice("10.10"), 1010);
	assert.equal(parsePrice("0.29"), 29);
	assert.equal(priceText(29), "0.29");
	for (const input of ["-50", "Rs 50", "1.234", "1e3", "", "100000"])
		assert.equal(parsePrice(input), null);
});
test("review preserves uncertainty, false and portion prices", () => {
	const draft = {
		currency: "INR",
		items: [
			{
				category: "Food",
				name: "Meal",
				priceMinor: null,
				vegetarian: null,
				variants: [{ name: "Half", priceMinor: 1010 }],
			},
		],
	};
	const editable = editDraft(draft);
	assert.equal(issues(editable), 1);
	editable[0].price = "20.20";
	editable[0].vegetarian = false;
	assert.equal(issues(editable), 0);
	assert.equal(reviewedItems(editable)[0].vegetarian, false);
	assert.equal(reviewedItems(editable)[0].priceMinor, 2020);
	assert.equal(reviewedItems(editable)[0].variants[0].priceMinor, 1010);
});
test("an invalid portion also blocks a valid base dish", () => {
	const editable = editDraft({
		currency: "INR",
		items: [
			{
				category: "Food",
				name: "Rice",
				priceMinor: 50,
				vegetarian: true,
				variants: [{ name: "Half", priceMinor: null }],
			},
		],
	});
	assert.equal(issues(editable), 1);
});
