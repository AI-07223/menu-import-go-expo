import test from "node:test";
import assert from "node:assert/strict";
import { readDemoMenus, saveDemoMenu } from "../src/demoStorage.ts";
import type { SavedMenu } from "../src/menu.ts";

test("sample edits including photos persist in this browser and storage errors preserve old data", () => {
    let value: string | null = null;
    let full = false;
    const storage = {
        getItem: () => value,
        setItem: (_key: string, contents: string) => {
            if (full) throw new Error("quota");
            value = contents;
        },
    };
    const item: SavedMenu = {id:"one", name:"Demo",currency:"USD",items:[{name:"Soup",category:"Main",priceMinor:123,vegetarian:null,photo:"data:image/png;base64,abc",variants:[]}]};
    assert.deepEqual(saveDemoMenu(storage,item), [item]);
    assert.deepEqual(readDemoMenus(storage), [item]);
    full = true;
    assert.throws(() => saveDemoMenu(storage,{...item,id:"two"}));
    assert.deepEqual(readDemoMenus(storage), [item]);
});
