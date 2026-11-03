import recordings from "./src/demo-runs.json";
import { useRef, useState, useEffect } from "react";
import {
	Alert,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
	Image,
    ImageSourcePropType,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { fields, request } from "./src/api";
import { readDemoMenus, saveDemoMenu } from "./src/demoStorage";
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

import house from "./public/kitchen/catalog.json";
import { closestDish } from "./src/matching";
import citrus from "./src/citrus.json";
import lunch from "./src/lunch.json";
import recorded from "./src/recorded.json";

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
const models = [
    {id:"reference",name:"Reference transcription"},
    {id:"qwen/qwen3.7-flash",name:"Qwen 3.7 Flash"},
    {id:"google/gemini-2.5-flash-lite",name:"Gemini 2.5 Flash-Lite"},
    {id:"deepseek/deepseek-v4.1-flash",name:"DeepSeek V4.1 Flash"},
];
const runs: Record<string,{draft:Draft;raw:string;returnedModel:string;recordedAt:string}> = recordings;
const examples = [
    {file:"sample-clear.png",name:"Classic Indian menu", image:require("./assets/sample-clear.png"), draft:recorded, info:"Reference transcription"},
    {file:"citrus-window.png",name:"Citrus Window · illustrated menu", image:require("./assets/citrus-window.png"), draft:citrus, info:"Illustrated reference · prepared transcription"},
    {file:"lunch-edition.jpg",name:"Café Lunch Edition · two-column menu", image:require("./assets/lunch-edition.jpg"), draft:lunch, info:"Recreated restaurant menu · prepared transcription"},
];
const homeMotion = "@media(prefers-reduced-motion:no-preference){[data-testid=home-card]{animation:home-in .32s ease-out both;transition:transform .18s ease,box-shadow .18s ease}[data-testid=home-card]:hover{transform:translateY(-2px);box-shadow:0 8px 24px #512d1514}[role=button]{transition:opacity .15s ease,transform .15s ease}@keyframes home-in{from{opacity:.4;translate:0 6px}to{opacity:1;translate:0 0}}}";
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
			style={({pressed})=>[
                pressed && {opacity:0.7,transform:[{scale:0.97}]},
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
        const units = Math.abs(delta) === 100 ? "one" : "ten";
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
	const [screen,setScreen]=useState<"upload"|"review"|"saved">("upload");
    const [error, setError] = useState("");
	const [saved, setSaved] = useState<SavedMenu[]>([]);
    const [demoSaved, setDemoSaved] = useState<SavedMenu[]>([]);
	const [model,setModel]=useState("google/gemini-2.5-flash-lite");
    const [sample,setSample]=useState(0);
    useEffect(()=>{
        if(Platform.OS!=="web") return;
        const style=document.createElement("style");style.textContent=homeMotion;document.head.append(style);
        return ()=>style.remove();
    },[]);
    const sampleDrafts = useRef<Record<string, {items: EditableItem[]; name: string; currency: string}>>({});
    const isSample=source==="SAMPLE MENU";
    const selectedRun=runs[examples[sample].file+"|"+model];
    const pending=isSample && model!=="reference" && !selectedRun;
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
			current.map((item, i) => (i === index ? { ...item, verified:false, ...update } : item)),
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
	function openExample(index:number,selection=model) {
        if (source && source !== "SAMPLE MENU") {
            setError("Finish your current import before opening a recorded demo.");
            return;
        }
        if (source === "SAMPLE MENU") {
            sampleDrafts.current[examples[sample].file+"|"+model] = {items, name, currency};
        }
        const example = examples[index];
        const run = runs[example.file+"|"+selection];
        const draft = selection === "reference" ? example.draft : run?.draft;
        const savedDraft = sampleDrafts.current[example.file+"|"+selection];
        setModel(selection); setSample(index);
        setCurrency(savedDraft?.currency ?? draft?.currency ?? "UNKNOWN");
        setItems(savedDraft?.items ?? (draft ? editDraft(draft) : []));
        setName(savedDraft?.name ?? example.name);
        setPhoto(null); setSource("SAMPLE MENU"); setScreen("review"); setError(""); setMessage("");
    }
    function artwork(item: {name:string; photo?:string|null}): ImageSourcePropType | undefined {
        if (item.photo) return {uri:item.photo};
        const normalize = (name:string) => name.trim().toLowerCase().replace(/\s+/g, " ");
        const match = house.find(row => normalize(row.name) === normalize(item.name));
        if (!match) return undefined;

        return catalogImages[match.image];
    }
    function addDish() {
        setItems(current => [...current, {name:"", category:"Menu", price:"", vegetarian:null, variants:[]}]);
    }
    function attachPhoto(index:number) {
        void action(async () => {
            const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],base64:true,quality:0.55});
            if (result.canceled) return;
            const asset=result.assets[0];
            if (!asset.base64) throw new Error("Could not read this photo.");
            let uri = "data:" + (asset.mimeType ?? "image/jpeg") + ";base64," + asset.base64;
            if (Platform.OS === "web") {
                const image = document.createElement("img");
                image.src=uri;
                await image.decode();
                const scale=Math.min(1,480/Math.max(image.width,image.height));
                const canvas=document.createElement("canvas");
                canvas.width=Math.max(1,Math.round(image.width*scale));
                canvas.height=Math.max(1,Math.round(image.height*scale));
                canvas.getContext("2d")!.drawImage(image,0,0,canvas.width,canvas.height);
                uri=canvas.toDataURL("image/jpeg",0.78);
            }
            if (uri.length>350000 || !/^data:image\/(jpeg|png);base64,/.test(uri)) throw new Error("Choose a smaller PNG or JPEG.");
            change(index,{photo:uri});
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
            if (window.confirm("Discard your current draft? This cannot be undone.")) discard();
        } else {
            Alert.alert("Discard draft?", "Your current changes will be lost.", [
                {text:"Keep draft",style:"cancel"},
                {text:"Discard",style:"destructive",onPress:discard},
            ]);
        }
    }

    function selectPhoto() {
        if (source) {
            setError("Finish or discard your current draft before importing another menu.");
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
			setScreen("review"); setItems(editDraft(data.scanMenu));
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
			if (!["INR", "USD"].includes(currency)) throw new Error("Confirm the currency before saving.");
            if (!items.length || invalid || !name.trim())
				throw new Error(
					"Resolve every highlighted dish and enter a menu name before saving.",
				);
            if (isSample && !token) {
                if (Platform.OS !== "web") throw new Error("Demo saving is available in the web browser. Configure a server token to save on this device.");
                const menu: SavedMenu = {id: crypto.randomUUID(), name:name.trim(), currency, items:reviewedItems(items)};
                try {
                    setDemoSaved(saveDemoMenu(window.localStorage, menu));
                } catch {
                    throw new Error("Could not save this demo in your browser. Your draft is still here.");
                }
                delete sampleDrafts.current[examples[sample].file+"|"+model];
                setItems([]); setSource(""); setPhoto(null); setScreen("saved");
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
                delete sampleDrafts.current[examples[sample].file+"|"+model];
            }
            setItems([]); setSource(""); setPhoto(null); setScreen("saved");
			setMessage(
				`Saved ${data.saveMenu.items.length} dishes to PostgreSQL. Reload saved menus to verify persistence.`,
			);
		});
	}
	return (
		<>
			<StatusBar style="dark" />
			{!!error && <View style={{position:Platform.OS==="web"?("fixed" as "absolute"):"absolute",top:0,left:0,right:0,zIndex:1000,backgroundColor:"#792a1a",paddingHorizontal:18,paddingVertical:10,flexDirection:"row",alignItems:"center",gap:12}}>
                <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{flex:1,color:"white",fontWeight:"600"}}>{error}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Dismiss error" onPress={()=>setError("")} style={{padding:10}}><Text style={{color:"white",fontWeight:"700"}}>Dismiss ×</Text></Pressable>
            </View>}
            <ScrollView key={screen}
                style={styles.screen}
				contentContainerStyle={styles.page}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.nav}>
					<Text style={styles.brand}>◩  Menu Import</Text>
					<Text style={styles.small}>{screen==="upload"?"01 / Upload":screen==="review"?"02 / Verify":"03 / Menus"}</Text>
                </View>
                {screen!=="upload" && <Button secondary title="Back to uploads" disabled={busy} onPress={()=>{setMessage("");setScreen("upload")}} />}
                {screen==="upload" && <>
                <View style={styles.hero}>
                    <Text style={styles.eyebrow}>THE RESTAURANT WORKSPACE</Text>
                    <Text style={styles.title}>Import your menu with confidence.</Text>
                    <Text style={styles.subtitle}>Based on a menu import workflow in my Billing project, this sample combines AI extraction with a catalog of common dishes and images. It suggests close matches for misread names, then lets restaurant owners review and correct every detail before saving. Large menus become easier to import and verify.</Text>
                </View>
                {source ? <View style={{gap:8}}>
                    <Button title="Continue verifying draft" onPress={()=>setScreen("review")} />
                    <Button secondary title="Discard draft" disabled={busy} onPress={discardDraft} />
                </View> : null}
                {<View style={styles.access}>
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
                <View style={styles.homeGrid}>
                    <View testID="home-card" style={styles.homeCard}>
                        <Image source={require("./assets/home-scan.png")} accessibilityLabel="Import a menu photo" resizeMode="cover" style={styles.cover}/>
                        <View style={styles.cardBody}>
                            <Text style={styles.eyebrow}>01 / IMPORT</Text><Text style={styles.cardTitle}>Import a menu</Text>
                            <Text style={[styles.small,{flex:1}]}>Upload a menu photo using your configured server. Set OPENROUTER_API_KEY in the server’s .env file to enable live scans.</Text>
                            <Button title={busy ? "Working…" : "Upload menu photo"} onPress={selectPhoto} disabled={busy || !token} />
                        </View>
                    </View>
                    <View testID="home-card" style={styles.homeCard}>
                        <Image source={require("./assets/home-compare.png")} accessibilityLabel="Recorded menu examples" resizeMode="cover" style={styles.cover}/>
                        <View style={styles.cardBody}>
                            <Text style={styles.eyebrow}>02 / EXPLORE</Text><Text style={styles.cardTitle}>Recorded demos</Text>
                            <Text style={[styles.small,{flex:1}]}>Explore three recorded menus and compare model output.</Text>
                            <Button title="Open menu demos" disabled={busy} onPress={() => openExample(0)} />
                        </View>
                    </View>
                </View>
                <Button secondary title="View saved menus" disabled={busy} onPress={() => void action(async () => {setScreen("saved");await refresh();})} />

                </>}
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
				{screen==="review" && (
					<View style={styles.section}>
						{isSample ? <View style={{gap:8,marginBottom:18}}>
                            <Text style={styles.eyebrow}>MENU DEMOS</Text><Text style={styles.label}>{model==="reference"?examples[sample].info:"Recorded scan · reasoning disabled in request"}</Text>
                            <Image accessibilityLabel={examples[sample].name} source={examples[sample].image} resizeMode="contain" style={{width:"100%",height:360,backgroundColor:"#f5efe6",borderRadius:12}}/>
                            {Platform.OS==="web"?<select aria-label="Choose menu photo" value={sample} disabled={busy} onChange={e=>openExample(Number(e.target.value),model)} style={{width:"100%",padding:14,fontSize:16,fontWeight:600,borderRadius:8,border:"1px solid #bfb5aa",background:"white"}}>{examples.map((x,i)=><option key={x.name} value={i}>{x.name}</option>)}</select>:examples.map((x,i)=><Button key={x.name} secondary={sample!==i} title={x.name} onPress={()=>openExample(i)}/>)}
                        <Text style={styles.label}>Model output</Text>
                            {Platform.OS==="web"?<select aria-label="Choose model output" value={model} onChange={e=>openExample(sample,e.target.value)} style={{padding:14,width:"100%",borderRadius:8,fontSize:16}}>{models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>:models.map(m=><Button key={m.id} title={m.name} secondary={model!==m.id} onPress={()=>openExample(sample,m.id)} />)}
                            {pending && <Text accessibilityLiveRegion="polite" style={styles.notice}>No recorded scan yet for this photo and model. Choose Reference transcription to explore this menu.</Text>}
                            {selectedRun && model!=="reference" && <><Text style={styles.small}>{selectedRun.returnedModel} · {selectedRun.recordedAt}</Text>{Platform.OS==="web" && <details><summary>Original model response</summary><pre style={{whiteSpace:"pre-wrap"}}>{selectedRun.raw}</pre></details>}</>}
                        </View>:<Text style={styles.eyebrow}>{source}</Text>}
						{!pending && <>
                        <View style={styles.headingRow}>
							<Text style={styles.heading}>Check the details.</Text>
							<Text style={styles.badge}>
								{items.length} dishes · {invalid} need attention
							</Text>
						</View>
						<Text style={styles.small}>
							All prices are {currency}. Review dietary labels and resolve invalid prices. Color shows review priority. AI percentages are estimates, not measured accuracy. Compare the original photo for missing dishes.
						</Text>
						{photo && (
							<Image
								accessibilityLabel="Uploaded menu reference"
								source={{ uri: photo }}
								resizeMode="contain"
								style={{ height: 220, marginTop: 16 }}
							/>
						)}
						<View style={{marginTop:16, gap:8}}>
                            <Text style={styles.label}>Menu currency · {currency === "UNKNOWN" ? "Choose currency" : currency}</Text>
                            <Button title="Indian rupees (INR)" secondary={currency !== "INR"} disabled={busy} onPress={() => setCurrency("INR")} />
                            <Button title="US dollars (USD)" secondary={currency !== "USD"} disabled={busy} onPress={() => setCurrency("USD")} />
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
						{items.map((item, index) => {
                            const incomplete = issues([item]) > 0;
                            const score = item.confidence;
                            const hue = incomplete ? 8 : item.verified ? 135 : score == null ? 40 : Math.round(10 + score * 0.78);
                            const label = incomplete ? "Needs correction" : item.verified ? "Verified by you" : score == null ? "Ready to review" : "Check against the photo";
                            return (
							<View
								key={index}
								style={[
									styles.card,
									{backgroundColor:`hsl(${hue}, 68%, 97%)`,borderLeftWidth:5,borderLeftColor:`hsl(${hue}, 55%, 39%)`},
								]}
							>
								<View style={{flexDirection:"row",alignItems:"center",gap:14,marginBottom:12}}>
                                    {artwork(item) && <Image source={artwork(item)} accessibilityLabel={item.photo ? "Uploaded dish photo" : "Catalog illustration of "+item.name} resizeMode="cover" style={{width:100,height:76,borderRadius:10}} />}
                                    <View style={{flex:1}}><Text style={styles.menuName}>{item.name || "New dish"}</Text>
                                    <Text style={styles.small}>{item.photo ? "Your dish photo" : artwork(item) ? "Catalog illustration" : "Photo optional"}</Text></View>
                                </View>
                                <Text style={styles.label}>{label}{score != null ? ` · AI estimate for original scan: ${score}%` : ""}</Text>
                                {!incomplete && !item.verified && <Button secondary title="Mark as verified" disabled={busy} onPress={()=>change(index,{verified:true})} />}
                                <Button secondary disabled={busy} title={item.photo ? "Replace dish photo" : "Add dish photo"} onPress={() => attachPhoto(index)} />
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
								{(() => {
                                    const candidate = closestDish(item.name, catalogDishes);
                                    if (!candidate || (candidate.name === item.name && candidate.category === item.category)) return null;
                                    return <Button secondary disabled={busy} title={`Use catalog match: ${candidate.name} · ${candidate.category}`} onPress={() => change(index, {name:candidate.name, category:candidate.category})} />;
                                })()}
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
										<Text style={styles.label}>Price · {currency}</Text>
										<PriceControl
											busy={busy}
											label={`Dish ${index + 1} price in ${currency}`}
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
											{ label: "Unspecified", value: null },
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
                                                {choice.value === null ? "Unspecified" : choice.value ? "Veg" : "Non-veg"}
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
											<Text style={styles.label}>Portion price · {currency}</Text>
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
						);})}
						<Button secondary disabled={busy} title="Add another dish" onPress={addDish} />
                        <Button
							title={busy?"Saving…":isSample && !token?"Save demo in this browser":"Save this menu"}
							onPress={save}
							disabled={busy}
						/>
					</>}
                    </View>
				)}
				{screen==="saved" && <View style={styles.section}>
					<Text style={styles.eyebrow}>SAVED MENUS</Text>
					<Text style={styles.heading}>Saved menus</Text>
                    <Text style={styles.small}>Demo saves stay in this browser. Restaurant menus require an operator token.</Text>
                    {!saved.length && !demoSaved.length ? (
						<Text style={styles.small}>
							Your verified menus will appear here after you save your first import.
						</Text>
					) : (
                        [...demoSaved.map(entry => ({entry, origin:"Demo · this browser"})), ...saved.map(entry => ({entry, origin:"Restaurant · server"}))].map(({entry, origin}) => (
							<View key={entry.id} style={styles.card}>
								<Text style={styles.menuName}>{entry.name}</Text>
                                <Text style={styles.small}>{origin}</Text>
								<Text style={styles.small}>
									{entry.items.length} dishes · {entry.currency}
								</Text>
								{entry.items.map((item, i) => (
									<View key={i} style={styles.savedRow}>
                                        {artwork(item) && <Image source={artwork(item)} accessibilityLabel={"Photo for "+item.name} style={{width:72,height:56,borderRadius:8}} />}
										<View style={{ flex: 1 }}>
											<Text style={styles.dishName}>{item.name}</Text>
											<Text style={styles.small}>
												{item.category} ·{" "}
												{item.vegetarian === null ? "Unspecified" : item.vegetarian ? "Vegetarian" : "Non-vegetarian"}
											</Text>
											{item.variants.map((v, j) => (
												<Text key={j} style={styles.small}>
													{v.name} · {entry.currency} {priceText(v.priceMinor)}
												</Text>
											))}
										</View>
										<Text style={styles.dishName}>
											{entry.currency} {priceText(item.priceMinor)}
										</Text>
									</View>
								))}
							</View>
						))
					)}
				</View>}
				
			<View style={styles.imprint}><Text style={styles.brand}>Menu Import</Text><Text style={styles.small}>Restaurant menu studio  /  Zaid Qureshi</Text></View>
            </ScrollView>
		</>
	);
}
const styles = StyleSheet.create({
	homeGrid:{flexDirection:"row",flexWrap:"wrap",gap:16,justifyContent:"center"},
    homeCard:{minHeight:355,width:"100%",flexBasis:280,flexGrow:1,maxWidth:480,borderWidth:1,borderColor:"#d7c9ba",borderRadius:18,backgroundColor:"#fffaf3"},
    cardBody:{flex:1,padding:17,gap:5},cardTitle:{fontFamily:"serif",fontWeight:"700",fontSize:27,color:"#35251b"},
    cover:{width:"100%",height:160,backgroundColor:"#f7ebd6"},
    imprint:{marginTop:36,paddingVertical:20,borderTopWidth:2,borderColor:"#a64c17",flexDirection:"row",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
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
});
