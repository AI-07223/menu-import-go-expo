import { useRef, useState, useEffect } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Image,
  ImageSourcePropType,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { fields, request } from "./src/api";
import { styles } from "./src/styles";
import { Button } from "./src/controls";
import { readDemoMenus, saveDemoMenu } from "./src/demoStorage";
import {
  Draft,
  EditableItem,
  SavedMenu,
  editDraft,
  issues,
  reviewedItems,
} from "./src/menu";

import house from "./public/kitchen/catalog.json";
import { DishEditor } from "./src/DishEditor";
import { ImportScreen } from "./src/ImportScreen";
import { SavedMenus } from "./src/SavedMenus";
import { DemoSelector } from "./src/DemoSelector";
import { examples, runs } from "./src/demoData";

const catalogImages: Record<string, ImageSourcePropType> = {
  "/kitchen/charred-corn.jpg": require("./public/kitchen/charred-corn.jpg"),
  "/kitchen/pepper-melt.jpg": require("./public/kitchen/pepper-melt.jpg"),
  "/kitchen/lime-chicken.jpg": require("./public/kitchen/lime-chicken.jpg"),
  "/kitchen/ginger-soda.jpg": require("./public/kitchen/ginger-soda.jpg"),
  "/kitchen/cherry-fizz.jpg": require("./public/kitchen/cherry-fizz.jpg"),
  "/kitchen/cold-brew.jpg": require("./public/kitchen/cold-brew.jpg"),
  "/kitchen/margherita-slice.jpg": require("./public/kitchen/margherita-slice.jpg"),
  "/kitchen/french-fries.jpg": require("./public/kitchen/french-fries.jpg"),
  "/kitchen/chocolate-donut.jpg": require("./public/kitchen/chocolate-donut.jpg"),
  "/kitchen/berry-cheesecake.jpg": require("./public/kitchen/berry-cheesecake.jpg"),
};
const homeMotion =
  "@media(prefers-reduced-motion:no-preference){[data-testid=home-card]{animation:home-in .32s ease-out both;transition:transform .18s ease,box-shadow .18s ease}[data-testid=home-card]:hover{transform:translateY(-2px);box-shadow:0 8px 24px #512d1514}[role=button]{transition:opacity .15s ease,transform .15s ease}@keyframes home-in{from{opacity:.4;translate:0 6px}to{opacity:1;translate:0 0}}}";
const baseURL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "web" ? "" : "http://localhost:8780");
export default function App() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [name, setName] = useState("My restaurant menu");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [screen, setScreen] = useState<"upload" | "review" | "saved">("upload");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedMenu[]>([]);
  const [demoSaved, setDemoSaved] = useState<SavedMenu[]>([]);
  const [model, setModel] = useState("google/gemini-2.5-flash-lite");
  const [sample, setSample] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const style = document.createElement("style");
    style.textContent = homeMotion;
    document.head.append(style);
    return () => style.remove();
  }, []);
  const sampleDrafts = useRef<
    Record<string, { items: EditableItem[]; name: string; currency: string }>
  >({});
  const isSample = source === "SAMPLE MENU";
  const selectedRun = runs[examples[sample].file + "|" + model];
  const pending = isSample && model !== "reference" && !selectedRun;
  const [currency, setCurrency] = useState("INR");
  const catalogDishes = house;

  const [photo, setPhoto] = useState<string | null>(null);
  const lock = useRef(false);
  const invalid = issues(items);
  async function action(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function change(index: number, update: Partial<EditableItem>) {
    setItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, verified: false, ...update } : item,
      ),
    );
  }
  async function refresh() {
    if (Platform.OS === "web") setDemoSaved(readDemoMenus(window.localStorage));
    if (!token) {
      setSaved([]);
      return;
    }
    const data = await request<{ menus: SavedMenu[] }>(
      baseURL,
      token,
      `query { menus { id name ${fields} } }`,
    );
    setSaved(data.menus);
  }
  function openExample(index: number, selection = model) {
    if (source && source !== "SAMPLE MENU") {
      setError("Finish your current import before opening a recorded demo.");
      return;
    }
    if (source === "SAMPLE MENU") {
      sampleDrafts.current[examples[sample].file + "|" + model] = {
        items,
        name,
        currency,
      };
    }
    const example = examples[index];
    const run = runs[example.file + "|" + selection];
    const draft = selection === "reference" ? example.draft : run?.draft;
    const savedDraft = sampleDrafts.current[example.file + "|" + selection];
    setModel(selection);
    setSample(index);
    setCurrency(savedDraft?.currency ?? draft?.currency ?? "UNKNOWN");
    setItems(savedDraft?.items ?? (draft ? editDraft(draft) : []));
    setName(savedDraft?.name ?? example.name);
    setPhoto(null);
    setSource("SAMPLE MENU");
    setScreen("review");
    setError("");
    setMessage("");
  }
  function artwork(item: {
    name: string;
    photo?: string | null;
  }): ImageSourcePropType | undefined {
    if (item.photo) return { uri: item.photo };
    const normalize = (name: string) =>
      name.trim().toLowerCase().replace(/\s+/g, " ");
    const match = house.find(
      (row) => normalize(row.name) === normalize(item.name),
    );
    if (!match) return undefined;

    return catalogImages[match.image];
  }
  function addDish() {
    setItems((current) => [
      ...current,
      { name: "", category: "Menu", price: "", vegetarian: null, variants: [] },
    ]);
  }
  function attachPhoto(index: number) {
    void action(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.55,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error("Could not read this photo.");
      let uri =
        "data:" + (asset.mimeType ?? "image/jpeg") + ";base64," + asset.base64;
      if (Platform.OS === "web") {
        const image = document.createElement("img");
        image.src = uri;
        await image.decode();
        const scale = Math.min(1, 480 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas
          .getContext("2d")!
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        uri = canvas.toDataURL("image/jpeg", 0.78);
      }
      if (uri.length > 350000 || !/^data:image\/(jpeg|png);base64,/.test(uri))
        throw new Error("Choose a smaller PNG or JPEG.");
      change(index, { photo: uri });
    });
  }
  function discardDraft() {
    const discard = () => {
      setItems([]);
      setSource("");
      setPhoto(null);
      setName("My restaurant menu");
      setCurrency("INR");
      sampleDrafts.current = {};
    };
    if (Platform.OS === "web") {
      if (window.confirm("Discard your current draft? This cannot be undone."))
        discard();
    } else {
      Alert.alert("Discard draft?", "Your current changes will be lost.", [
        { text: "Keep draft", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: discard },
      ]);
    }
  }

  function selectPhoto() {
    if (source) {
      setError(
        "Finish or discard your current draft before importing another menu.",
      );
      return;
    }
    scan();
  }

  function scan() {
    void action(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (
        !asset.base64 ||
        !["image/jpeg", "image/png"].includes(asset.mimeType ?? "")
      )
        throw new Error("Choose a PNG or JPEG image.");
      if (asset.base64.length > 5_592_408)
        throw new Error("Choose an image under 4 MiB.");
      const data = await request<{ scanMenu: Draft }>(
        baseURL,
        token,
        `mutation Scan($image: String!) { scanMenu(image: $image) { ${fields} } }`,
        { image: `data:${asset.mimeType};base64,${asset.base64}` },
      );
      setName("My restaurant menu");
      setCurrency(data.scanMenu.currency);
      setPhoto(asset.uri);
      setScreen("review");
      setItems(editDraft(data.scanMenu));
      setSource("LIVE EXTRACTION · REVIEW REQUIRED");
      setMessage(
        data.scanMenu.items.length
          ? "Draft extracted. Verify every field against the image."
          : "No dishes found. Try a clearer image.",
      );
    });
  }
  function save() {
    void action(async () => {
      if (!["INR", "USD"].includes(currency))
        throw new Error("Confirm the currency before saving.");
      if (!items.length || invalid || !name.trim())
        throw new Error(
          "Resolve every highlighted dish and enter a menu name before saving.",
        );
      if (isSample && !token) {
        if (Platform.OS !== "web")
          throw new Error(
            "Demo saving is available in the web browser. Configure a server token to save on this device.",
          );
        const menu: SavedMenu = {
          id: crypto.randomUUID(),
          name: name.trim(),
          currency,
          items: reviewedItems(items),
        };
        try {
          setDemoSaved(saveDemoMenu(window.localStorage, menu));
        } catch {
          throw new Error(
            "Could not save this demo in your browser. Your draft is still here.",
          );
        }
        delete sampleDrafts.current[examples[sample].file + "|" + model];
        setItems([]);
        setSource("");
        setPhoto(null);
        setScreen("saved");
        setMessage("Demo saved in this browser only.");
        return;
      }
      const data = await request<{ saveMenu: SavedMenu }>(
        baseURL,
        token,
        `mutation Save($input: ReviewedMenuInput!) { saveMenu(input: $input) { id name ${fields} } }`,
        {
          input: {
            name: name.trim(),
            currency,
            items: reviewedItems(items),
          },
        },
      );
      setSaved((current) => [
        data.saveMenu,
        ...current.filter((m) => m.id !== data.saveMenu.id),
      ]);
      if (source === "SAMPLE MENU") {
        delete sampleDrafts.current[examples[sample].file + "|" + model];
      }
      setItems([]);
      setSource("");
      setPhoto(null);
      setScreen("saved");
      setMessage(
        `Saved ${data.saveMenu.items.length} dishes to PostgreSQL. Reload saved menus to verify persistence.`,
      );
    });
  }
  return (
    <>
      <StatusBar style="dark" />
      {!!error && (
        <View
          style={{
            position:
              Platform.OS === "web" ? ("fixed" as "absolute") : "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: "#792a1a",
            paddingHorizontal: 18,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={{ flex: 1, color: "white", fontWeight: "600" }}
          >
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
            onPress={() => setError("")}
            style={{ padding: 10 }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Dismiss ×</Text>
          </Pressable>
        </View>
      )}
      <ScrollView
        key={screen}
        style={styles.screen}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.nav}>
          <Text style={styles.brand}>◩ Menu Import</Text>
          <Text style={styles.small}>
            {screen === "upload"
              ? "01 / Upload"
              : screen === "review"
                ? "02 / Verify"
                : "03 / Menus"}
          </Text>
        </View>
        {screen !== "upload" && (
          <Button
            secondary
            title="Back to uploads"
            disabled={busy}
            onPress={() => {
              setMessage("");
              setScreen("upload");
            }}
          />
        )}
        {screen === "upload" && (
          <ImportScreen
            source={source}
            token={token}
            busy={busy}
            onContinue={() => setScreen("review")}
            onDiscard={discardDraft}
            onTokenChange={setToken}
            onUpload={selectPhoto}
            onExamples={() => openExample(0)}
            onSaved={() =>
              void action(async () => {
                setScreen("saved");
                await refresh();
              })
            }
          />
        )}
        {busy && (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            Working…
          </Text>
        )}
        {!!message && (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {message}
          </Text>
        )}
        {screen === "review" && (
          <View style={styles.section}>
            {isSample ? (
              <DemoSelector
                sample={sample}
                model={model}
                busy={busy}
                pending={pending}
                selectedRun={selectedRun}
                openExample={openExample}
              />
            ) : (
              <Text style={styles.eyebrow}>{source}</Text>
            )}
            {!pending && (
              <>
                <View style={styles.headingRow}>
                  <Text style={styles.heading}>Check the details.</Text>
                  <Text style={styles.badge}>
                    {items.length} dishes · {invalid} need attention
                  </Text>
                </View>
                <Text style={styles.small}>
                  All prices are {currency}. Review dietary labels and resolve
                  invalid prices. Color shows review priority. AI percentages
                  are estimates, not measured accuracy. Compare the original
                  photo for missing dishes.
                </Text>
                {photo && (
                  <Image
                    accessibilityLabel="Uploaded menu reference"
                    source={{ uri: photo }}
                    resizeMode="contain"
                    style={{ height: 220, marginTop: 16 }}
                  />
                )}
                <View style={{ marginTop: 16, gap: 8 }}>
                  <Text style={styles.label}>
                    Menu currency ·{" "}
                    {currency === "UNKNOWN" ? "Choose currency" : currency}
                  </Text>
                  <Button
                    title="Indian rupees (INR)"
                    secondary={currency !== "INR"}
                    disabled={busy}
                    onPress={() => setCurrency("INR")}
                  />
                  <Button
                    title="US dollars (USD)"
                    secondary={currency !== "USD"}
                    disabled={busy}
                    onPress={() => setCurrency("USD")}
                  />
                </View>
                <Text style={[styles.label, { marginTop: 20 }]}>Menu name</Text>
                <TextInput
                  editable={!busy}
                  accessibilityLabel="Menu name"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  maxLength={120}
                />
                {items.map((item, index) => (
                  <DishEditor
                    key={index}
                    item={item}
                    index={index}
                    busy={busy}
                    currency={currency}
                    catalogDishes={catalogDishes}
                    artwork={artwork}
                    change={change}
                    attachPhoto={attachPhoto}
                    onRemove={() =>
                      setItems((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  />
                ))}
                <Button
                  secondary
                  disabled={busy}
                  title="Add another dish"
                  onPress={addDish}
                />
                <Button
                  title={
                    busy
                      ? "Saving…"
                      : isSample && !token
                        ? "Save demo in this browser"
                        : "Save this menu"
                  }
                  onPress={save}
                  disabled={busy}
                />
              </>
            )}
          </View>
        )}
        {screen === "saved" && (
          <SavedMenus saved={saved} demoSaved={demoSaved} artwork={artwork} />
        )}

        <View style={styles.imprint}>
          <Text style={styles.brand}>Menu Import</Text>
          <Text style={styles.small}>
            Restaurant menu studio / Zaid Qureshi
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
