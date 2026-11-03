import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {closestDish} from "../src/matching.ts";
const runs = JSON.parse(readFileSync(new URL("../src/demo-runs.json", import.meta.url), "utf8"));
test("recorded scans match all three source images and three models", () => {
    const images = ["sample-clear.png", "citrus-window.png", "lunch-edition.jpg"];
    const models = ["qwen/qwen3.7-flash", "google/gemini-2.5-flash-lite", "deepseek/deepseek-v4.1-flash"];
    for (const image of images) {
        const bytes = readFileSync(new URL("../assets/" + image, import.meta.url));
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        for (const model of models) {
            assert.equal(runs[image + "|" + model].imageSha256, sha256);
        }
    }
});
test("suggest a close typo, abstain for ties and unrelated dishes", () => {
    const dishes=[{name:"Ginger soda",category:"Drinks"},{name:"Cherry fizz",category:"Drinks"}];
    assert.equal(closestDish("Gingr soda",dishes)?.name,"Ginger soda");
    assert.equal(closestDish("Lamb kebab",dishes),undefined);
    assert.equal(closestDish("Ginger soda",[...dishes,dishes[0]]),undefined);
});
