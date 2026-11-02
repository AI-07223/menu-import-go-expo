type Dish = { name: string; category: string };
const key = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function distance(left: string, right: string): number {
    let row = Array.from({length: right.length + 1}, (_, i) => i);
    for (let i = 1; i <= left.length; i++) {
        const next = [i];
        for (let j = 1; j <= right.length; j++) {
            next.push(Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + Number(left[i - 1] !== right[j - 1])));
        }
        row = next;
    }
    return row[right.length];
}

export function closestDish(input: string, dishes: Dish[]): Dish | undefined {
    const query = key(input);
    if (!query || query.length > 255) return;
    const limit = Math.min(2, Math.floor(query.length / 4));
    const ranked = dishes.map(dish => ({dish, cost: distance(query, key(dish.name))}))
        .filter(entry => entry.cost <= limit).sort((a,b) => a.cost - b.cost);
    if (ranked.length && ranked[0].cost !== ranked[1]?.cost) return ranked[0].dish;
}
