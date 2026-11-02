import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {closestDish} from "../src/matching.ts";
const entries = JSON.parse(readFileSync(new URL("../src/catalog.json", import.meta.url),"utf8"));
test("each menu reference matches its source image bytes", () => {
    for (const entry of entries) for (const image of entry.images) {
        const bytes=readFileSync(new URL("../assets/"+image.file, import.meta.url));
        assert.equal(createHash("sha256").update(bytes).digest("hex"),image.sha256);
    }
});
test("suggest a close typo, abstain for ties and unrelated dishes", () => {
    const dishes=[{name:"Ginger soda",category:"Drinks"},{name:"Cherry fizz",category:"Drinks"}];
    assert.equal(closestDish("Gingr soda",dishes)?.name,"Ginger soda");
    assert.equal(closestDish("Lamb kebab",dishes),undefined);
    assert.equal(closestDish("Ginger soda",[...dishes,dishes[0]]),undefined);
});
