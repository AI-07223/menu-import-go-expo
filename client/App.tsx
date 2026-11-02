import { useRef, useState } from "react";
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
	Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { fields, request } from "./src/api";
import {
	Draft,
	EditableItem,
	SavedMenu,
	editDraft,
	issues,
	priceText,
	parsePrice,
	reviewedItems,
} from "./src/menu";

import recorded from "./src/recorded.json";
const publicDemo = process.env.EXPO_PUBLIC_RECORDED_DEMO === "1";
const storageKey = "menu-review.saved.v1";
function browserMenus(): SavedMenu[] {
	return JSON.parse(localStorage.getItem(storageKey) ?? "[]");
}

const baseURL =
	process.env.EXPO_PUBLIC_API_URL ??
	(Platform.OS === "web" ? "" : "http://localhost:8780");
function Button({
	title,
	onPress,
	disabled = false,
	secondary = false,
}: {
	title: string;
	onPress: () => void;
	disabled?: boolean;
	secondary?: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={title}
			disabled={disabled}
			onPress={onPress}
			style={[
				styles.button,
				secondary && styles.secondary,
				disabled && { opacity: 0.45 },
			]}
		>
			<Text style={[styles.buttonText, secondary && { color: "#252321" }]}>
				{title}
			</Text>
		</Pressable>
	);
}
function PriceControl({label, value, onChange, busy}: {
    label: string; value: string; onChange: (value: string) => void; busy: boolean;
}) {
    const amount = parsePrice(value);
    function step(delta: number, symbol: string) {
        const next = (amount ?? 0) + delta;
        const disabled = busy || next <= 0 || next > 9999999 || (amount === null && value.trim() !== "");
        const direction = delta > 0 ? "increase" : "decrease";
        const units = Math.abs(delta) === 100 ? "one rupee" : "ten rupees";
        return (
            <Pressable accessibilityRole="button" accessibilityLabel={label + ", " + direction + " by " + units}
                disabled={disabled} onPress={() => onChange(priceText(next))}
                style={[styles.step, disabled && {opacity: 0.4}]}>
                <Text style={styles.stepText}>{symbol}</Text>
            </Pressable>
        );
    }
    return (
        <View style={{gap: 5}}>
            <TextInput accessibilityLabel={label} editable={!busy} keyboardType="decimal-pad"
                value={value} onChangeText={onChange} style={styles.input} />
            <View style={styles.stepper}>
                {step(-1000, "−10")}{step(-100, "−1")}{step(100, "+1")}{step(1000, "+10")}
            </View>
        </View>
    );
}
export default function App() {
	const [token, setToken] = useState("");
	const [items, setItems] = useState<EditableItem[]>([]);
	const [name, setName] = useState("My restaurant menu");
	const [source, setSource] = useState("");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [saved, setSaved] = useState<SavedMenu[]>([]);
	const [softPhoto, setSoftPhoto] = useState(false);
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
			current.map((item, i) => (i === index ? { ...item, ...update } : item)),
		);
	}
	async function refresh() {
		if (publicDemo) { setSaved(browserMenus()); return; }
		const data = await request<{ menus: SavedMenu[] }>(
			baseURL,
			token,
			`query { menus { id name ${fields} } }`,
		);
		setSaved(data.menus);
	}
	function demo() {
		void action(async () => {
			const data = publicDemo ? { demoDraft: recorded } : await request<{ demoDraft: Draft }>(
				baseURL,
				token,
				`query { demoDraft { ${fields} } }`,
			);
			setItems(editDraft(data.demoDraft));
			setPhoto(null);
			setSource("RECORDED DEMO · NO AI CALL");
			setMessage(
				"Loaded a recorded synthetic menu. Check the draft before saving.",
			);
		});
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
			setPhoto(asset.uri);
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
			if (!items.length || invalid || !name.trim())
				throw new Error(
					"Resolve every highlighted dish and enter a menu name before saving.",
				);
			if (publicDemo) {
                const menu = { id: crypto.randomUUID(), name: name.trim(), currency: "INR", items: reviewedItems(items) };
                const recent = [menu, ...browserMenus()].slice(0, 10);
                localStorage.setItem(storageKey, JSON.stringify(recent));
                setSaved(recent);
                setItems([]);
                setMessage("Saved in this browser. Reload saved menus to see it again.");
                return;
            }
            const data = await request<{ saveMenu: SavedMenu }>(
				baseURL,
				token,
				`mutation Save($input: ReviewedMenuInput!) { saveMenu(input: $input) { id name ${fields} } }`,
				{
					input: {
						name: name.trim(),
						currency: "INR",
						items: reviewedItems(items),
					},
				},
			);
			setSaved((current) => [
				data.saveMenu,
				...current.filter((m) => m.id !== data.saveMenu.id),
			]);
			setItems([]);
			setMessage(
				`Saved ${data.saveMenu.items.length} dishes to PostgreSQL. Reload saved menus to verify persistence.`,
			);
		});
	}
	return (
		<>
			<StatusBar style="dark" />
			<ScrollView
				style={styles.screen}
				contentContainerStyle={styles.page}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.nav}>
					<Text style={styles.brand}>MENU / REVIEW</Text>
					<Text style={styles.small}>A focused engineering sample</Text>
				</View>
				<View style={styles.hero}>
					<Text style={styles.eyebrow}>EXTRACT → REVIEW → SAVE</Text>
					<Text style={styles.title}>A menu worth{`\n`}a second look.</Text>
					<Text style={styles.subtitle}>
						Turn a photo into a draft. Keep the judgment with the person who
						knows the menu.
					</Text>
				</View>
				{!publicDemo && <View style={styles.access}>
					<View style={{ flex: 1, minWidth: 180 }}>
						<Text style={styles.label}>Operator token</Text>
						<Text style={styles.small}>
							Held in memory only. Use the token from your local setup.
						</Text>
					</View>
					<TextInput
						editable={!busy}
						style={[styles.input, { minWidth: 220, flex: 1 }]}
						accessibilityLabel="Operator token"
						secureTextEntry
						value={token}
						onChangeText={setToken}
						placeholder="Enter your operator token"
						autoCapitalize="none"
					/>
				</View>}
				<View style={styles.actions}>
					<Button
						title="Try recorded demo"
						onPress={demo}
						disabled={busy || (!publicDemo && !token)}
					/>
					{!publicDemo && <Button
						title="Extract from photo"
						onPress={scan}
                        disabled={busy || (!publicDemo && !token)}
                        secondary
                    />}
					<Button
						title="Reload saved menus"
						onPress={() => void action(refresh)}
						disabled={busy || (!publicDemo && !token)}
						secondary
					/>
				</View>
				<Text style={styles.small}>
					{publicDemo ? "Try the recorded menu, edit a dish, and save. Your last ten menus stay in this browser. No photo upload or live AI call." : "Demo uses a recorded synthetic extraction. Photo extraction sends your image to configured AI providers; it requires a server-side API key."}
                </Text>
				{busy && (
					<Text accessibilityLiveRegion="polite" style={styles.notice}>
						Working…
					</Text>
				)}
				{!!error && (
					<Text accessibilityRole="alert" style={styles.error}>
						{error}
					</Text>
				)}
				{!!message && (
					<Text accessibilityLiveRegion="polite" style={styles.notice}>
						{message}
					</Text>
				)}
				{!!items.length && (
					<View style={styles.section}>
						<Text style={styles.eyebrow}>{source}</Text>
						<View style={styles.headingRow}>
							<Text style={styles.heading}>Check the details.</Text>
							<Text style={styles.badge}>
								{items.length} dishes · {invalid} need attention
							</Text>
						</View>
						<Text style={styles.small}>
							All prices are INR. Unknown dietary labels and invalid prices must
							be resolved. Review model-provided labels too.
						</Text>
						{!photo && source.startsWith("RECORDED") && <View style={{marginTop: 16}}>
                            <Text style={styles.label}>Sample menu photo · {softPhoto ? "soft focus" : "clear print"}</Text>
                            <Image accessibilityLabel="Simulated restaurant menu with six dishes and printed prices" source={softPhoto ? require("./assets/sample-blurred.png") : require("./assets/sample-clear.png")} resizeMode="contain" style={{width:"100%",height:250,backgroundColor:"#eee9de",borderRadius:10}} />
                            <Button secondary disabled={busy} title={softPhoto ? "View clear photo" : "View soft-focus photo"} onPress={() => setSoftPhoto(!softPhoto)} />
                        </View>}
                        {photo && (
							<Image
								accessibilityLabel="Uploaded menu reference"
								source={{ uri: photo }}
								resizeMode="contain"
								style={{ height: 220, marginTop: 16 }}
							/>
						)}
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
							<View
								key={index}
								style={[
									styles.card,
									issues([item]) > 0 && styles.needsAttention,
								]}
							>
								<View style={styles.headingRow}>
									<Text style={styles.small}>
										DISH {String(index + 1).padStart(2, "0")}
									</Text>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel={`Remove dish ${index + 1}`}
										disabled={busy}
										onPress={() =>
											setItems((current) =>
												current.filter((_, i) => i !== index),
											)
										}
									>
										<Text style={styles.remove}>Remove</Text>
									</Pressable>
								</View>
								<View style={styles.fields}>
									<View style={styles.field}>
										<Text style={styles.label}>Dish name</Text>
										<TextInput
											editable={!busy}
											accessibilityLabel={`Dish ${index + 1} name`}
											style={styles.input}
											value={item.name}
											maxLength={255}
											onChangeText={(name) => change(index, { name })}
										/>
									</View>
									<View style={styles.field}>
										<Text style={styles.label}>Category</Text>
										<TextInput
											editable={!busy}
											accessibilityLabel={`Dish ${index + 1} category`}
											style={styles.input}
											value={item.category}
											maxLength={120}
											onChangeText={(category) => change(index, { category })}
										/>
									</View>
									<View style={{minWidth: 170, flexGrow: 1}}>
										<Text style={styles.label}>Price · INR</Text>
										<PriceControl
											busy={busy}
											label={`Dish ${index + 1} price in rupees`}
											value={item.price}
											onChange={(price) => change(index, { price })}
										/>
									</View>
								</View>
								<View
									accessibilityRole="radiogroup"
									accessibilityLabel={`Dish ${index + 1} dietary classification`}
									style={styles.choices}
								>
									{(
										[
											{ label: "Needs review", value: null },
											{ label: "Vegetarian", value: true },
											{ label: "Non-vegetarian", value: false },
										] as const
									).map((choice) => (
										<Pressable
											key={choice.label}
											accessibilityRole="radio"
											disabled={busy}
											accessibilityState={{
												checked: item.vegetarian === choice.value,
											}}
											accessibilityLabel={`Dish ${index + 1}: ${choice.label}`}
											onPress={() =>
												change(index, { vegetarian: choice.value })
											}
											style={[
												styles.choice,
												item.vegetarian === choice.value && styles.selected,
											]}
										>
											<Text
												style={{
													color:
														item.vegetarian === choice.value
															? "#fff"
															: "#252321",
												}}
											>
                                                {choice.value === null ? "Review" : choice.value ? "Veg" : "Non-veg"}
											</Text>
										</Pressable>
									))}
								</View>
								{item.variants.map((variant, vi) => (
									<View key={vi} style={styles.fields}>
										<View style={styles.field}>
											<Text style={styles.label}>Portion</Text>
											<TextInput
												editable={!busy}
												accessibilityLabel={`Dish ${index + 1} portion ${vi + 1} name`}
												style={styles.input}
												value={variant.name}
												onChangeText={(name) =>
													change(index, {
														variants: item.variants.map((v, j) =>
															j === vi ? { ...v, name } : v,
														),
													})
												}
											/>
										</View>
										<View style={styles.field}>
											<Text style={styles.label}>Portion price · INR</Text>
											<PriceControl
												busy={busy}
												label={`Dish ${index + 1} portion ${vi + 1} price`}
												value={variant.price}
												onChange={(price) =>
													change(index, {
														variants: item.variants.map((v, j) =>
															j === vi ? { ...v, price } : v,
														),
													})
												}
											/>
										</View>
									</View>
								))}
							</View>
						))}
						<Button
							title={`Save ${items.length} reviewed dishes`}
							onPress={save}
							disabled={busy}
						/>
					</View>
				)}
				<View style={styles.section}>
					<Text style={styles.eyebrow}>{publicDemo ? "SAVED IN THIS BROWSER" : "PERSISTED IN POSTGRESQL"}</Text>
					<Text style={styles.heading}>Saved menus</Text>
					{!saved.length ? (
						<Text style={styles.small}>
							No menus loaded. Connect and reload, or save a reviewed draft.
						</Text>
					) : (
						saved.map((entry) => (
							<View key={entry.id} style={styles.card}>
								<Text style={styles.menuName}>{entry.name}</Text>
								<Text style={styles.small}>
									{entry.items.length} dishes · {entry.currency}
								</Text>
								{entry.items.map((item, i) => (
									<View key={i} style={styles.savedRow}>
										<View style={{ flex: 1 }}>
											<Text style={styles.dishName}>{item.name}</Text>
											<Text style={styles.small}>
												{item.category} ·{" "}
												{item.vegetarian ? "Vegetarian" : "Non-vegetarian"}
											</Text>
											{item.variants.map((v, j) => (
												<Text key={j} style={styles.small}>
													{v.name} · INR {priceText(v.priceMinor)}
												</Text>
											))}
										</View>
										<Text style={styles.dishName}>
											INR {priceText(item.priceMinor)}
										</Text>
									</View>
								))}
							</View>
						))
					)}
				</View>
				<Text style={styles.footer}>
					AI-assisted implementation · Human-reviewed data · No automatic
					publishing
				</Text>
			</ScrollView>
		</>
	);
}
const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#faf9f7" },
	page: {
		maxWidth: 1050,
		width: "100%",
		alignSelf: "center",
		paddingHorizontal: 24,
		paddingBottom: 48,
	},
	nav: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 12,
		paddingVertical: 24,
		borderBottomWidth: 1,
		borderColor: "#dedbd8",
	},
	brand: {
		fontSize: 18,
		fontWeight: "800",
		color: "#252321",
		letterSpacing: 2,
	},
	hero: { paddingVertical: 38 },
	eyebrow: {
		color: "#ac4600",
		fontWeight: "700",
		fontSize: 11,
		letterSpacing: 2,
		marginBottom: 12,
	},
	title: {
		fontSize: 48,
		lineHeight: 53,
		letterSpacing: -2,
		fontWeight: "800",
		color: "#252321",
	},
	subtitle: {
		fontSize: 17,
		lineHeight: 26,
		color: "#515151",
		maxWidth: 550,
		marginTop: 16,
	},
	access: {
		backgroundColor: "#fff0df",
		padding: 18,
		borderRadius: 14,
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "wrap",
		gap: 16,
	},
	actions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		marginTop: 18,
		marginBottom: 12,
	},
	button: {
		backgroundColor: "#b64a00",
		paddingVertical: 14,
		paddingHorizontal: 20,
		borderRadius: 9,
		alignItems: "center",
	},
	secondary: { backgroundColor: "#ffe9cf" },
	buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
	small: { fontSize: 12, lineHeight: 19, color: "#585552" },
	label: { fontSize: 12, fontWeight: "700", color: "#32302f", marginBottom: 6 },
	input: {
		backgroundColor: "#fff",
		color: "#242424",
		borderWidth: 1,
		borderColor: "#cdc9c5",
		borderRadius: 7,
		padding: 12,
		fontSize: 15,
	},
	notice: {
		padding: 14,
		backgroundColor: "#fff0df",
		borderRadius: 8,
		color: "#743400",
		marginTop: 16,
		lineHeight: 21,
	},
	error: {
		padding: 14,
		backgroundColor: "#fae5de",
		color: "#8a3021",
		borderRadius: 8,
		marginTop: 16,
		lineHeight: 21,
	},
	section: { marginTop: 40 },
	heading: {
		fontSize: 27,
		fontWeight: "700",
		color: "#252321",
		marginBottom: 8,
	},
	headingRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: 10,
		alignItems: "center",
		marginBottom: 12,
	},
	badge: {
		color: "#713500",
		backgroundColor: "#ffe1bf",
		padding: 8,
		borderRadius: 7,
		fontSize: 12,
	},
	card: {
		padding: 20,
		borderWidth: 1,
		borderColor: "#dedbd8",
		backgroundColor: "#ffffff",
		borderRadius: 12,
		marginTop: 16,
		marginBottom: 8,
	},
	needsAttention: { borderColor: "#bd7547", backgroundColor: "#fff7e9" },
	fields: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
	field: { flex: 1, minWidth: 140 },
	stepper: {flexDirection:"row", alignItems:"center", gap:4},
    step: {flex:1,minWidth:34,height:44,borderRadius:8,backgroundColor:"#ffe3c3",alignItems:"center",justifyContent:"center"},
    stepText: {fontSize:16,fontWeight:"700",color:"#252321"},
    choices: { flexDirection: "row", backgroundColor:"#f3eeea", padding:3, borderRadius:10, marginTop:12 },
	choice: {
		paddingVertical: 10,
		flex:1, minHeight:44, alignItems:"center", justifyContent:"center",
		borderWidth: 1,
		borderColor: "#cdc9c5",
		borderRadius: 7,
	},
	selected: { backgroundColor: "#a84100", borderColor: "#a84100" },
	remove: { color: "#914d39", fontSize: 12 },
	menuName: {
		color: "#252321",
		fontSize: 20,
		fontWeight: "700",
		marginBottom: 6,
	},
	savedRow: {
		flexDirection: "row",
		gap: 16,
		borderTopWidth: 1,
		borderColor: "#e3ded9",
		marginTop: 14,
		paddingTop: 14,
	},
	dishName: { fontSize: 14, fontWeight: "600", color: "#2d2b29" },
	footer: { marginTop: 36, fontSize: 11, color: "#686461", lineHeight: 18 },
});
