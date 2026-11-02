export type Variant = { name: string; priceMinor: number | null };
export type Item = {
 confidence?: number | null;
 photo?: string | null;
	category: string;
	name: string;
	priceMinor: number | null;
	vegetarian: boolean | null;
	variants: Variant[];
};
export type Draft = { currency: string; items: Item[] };
export type SavedMenu = Draft & { id: string; name: string };
export type EditableItem = Omit<Item, "priceMinor" | "variants"> & {
	verified?: boolean;
 price: string;
	variants: { name: string; price: string }[];
};

// Decimal text to integer paise: do not use parseFloat or round binary floats.
export function parsePrice(value: string): number | null {
	if (!/^\d{1,5}(\.\d{1,2})?$/.test(value.trim())) return null;
	const [whole, fraction = ""] = value.trim().split(".");
	return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function priceText(value: number | null): string {
	return value === null
		? ""
		: `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
export function editDraft(draft: Draft): EditableItem[] {
	return draft.items.map((item) => ({
		...item,
		price: priceText(item.priceMinor),
		variants: item.variants.map((v) => ({
			name: v.name,
			price: priceText(v.priceMinor),
		})),
	}));
}
export function reviewedItems(items: EditableItem[]): Item[] {
	return items.map(({ price, variants, name, category, vegetarian, photo }) => ({
        name, category, vegetarian, photo,
		priceMinor: parsePrice(price),
		variants: variants.map((v) => ({
			name: v.name,
			priceMinor: parsePrice(v.price),
		})),
	}));
}
export function issues(items: EditableItem[]): number {
	return items.filter(
		(item) =>
			!item.name.trim() ||
			!item.category.trim() ||
			item.vegetarian === null ||
			(parsePrice(item.price) ?? 0) <= 0 ||
			item.variants.some(
				(v) => !v.name.trim() || (parsePrice(v.price) ?? 0) <= 0,
			),
	).length;
}
