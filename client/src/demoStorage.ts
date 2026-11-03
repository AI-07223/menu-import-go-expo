import type { SavedMenu } from "./menu";

const key = "menu-review.saved.v1";

export function readDemoMenus(storage: Pick<Storage, "getItem" | "setItem">): SavedMenu[] {
    const value = storage.getItem(key);
    if (!value) return [];
    const menus: unknown = JSON.parse(value);
    if (!Array.isArray(menus)) throw new Error("Saved demos could not be read. Your browser data has not been changed.");
    return menus as SavedMenu[];
}

export function saveDemoMenu(storage: Pick<Storage, "getItem" | "setItem">, menu: SavedMenu): SavedMenu[] {
    const menus = [menu, ...readDemoMenus(storage)];
    storage.setItem(key, JSON.stringify(menus));
    return menus;
}
