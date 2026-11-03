import { Image, Platform, Text, View } from "react-native";
import { Button } from "./controls";
import { examples, models } from "./demoData";
import { styles } from "./styles";

type Props = {
  sample: number;
  model: string;
  busy: boolean;
  pending: boolean;
  selectedRun?: { returnedModel: string; recordedAt: string; raw: string };
  openExample: (index: number, model?: string) => void;
};

export function DemoSelector({
  sample,
  model,
  busy,
  pending,
  selectedRun,
  openExample,
}: Props) {
  return (
    <View style={{ gap: 8, marginBottom: 18 }}>
      <Text style={styles.eyebrow}>MENU DEMOS</Text>
      <Text style={styles.label}>
        {model === "reference"
          ? examples[sample].info
          : "Recorded scan · reasoning disabled in request"}
      </Text>
      <Image
        accessibilityLabel={examples[sample].name}
        source={examples[sample].image}
        resizeMode="contain"
        style={{
          width: "100%",
          height: 360,
          backgroundColor: "#f5efe6",
          borderRadius: 12,
        }}
      />
      {Platform.OS === "web" ? (
        <select
          aria-label="Choose menu photo"
          value={sample}
          disabled={busy}
          onChange={(e) => openExample(Number(e.target.value), model)}
          style={{
            width: "100%",
            padding: 14,
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid #bfb5aa",
            background: "white",
          }}
        >
          {examples.map((x, i) => (
            <option key={x.name} value={i}>
              {x.name}
            </option>
          ))}
        </select>
      ) : (
        examples.map((x, i) => (
          <Button
            key={x.name}
            secondary={sample !== i}
            title={x.name}
            onPress={() => openExample(i)}
          />
        ))
      )}
      <Text style={styles.label}>Model output</Text>
      {Platform.OS === "web" ? (
        <select
          aria-label="Choose model output"
          value={model}
          onChange={(e) => openExample(sample, e.target.value)}
          style={{
            padding: 14,
            width: "100%",
            borderRadius: 8,
            fontSize: 16,
          }}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      ) : (
        models.map((m) => (
          <Button
            key={m.id}
            title={m.name}
            secondary={model !== m.id}
            onPress={() => openExample(sample, m.id)}
          />
        ))
      )}
      {pending && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          No recorded scan yet for this photo and model. Choose Reference
          transcription to explore this menu.
        </Text>
      )}
      {selectedRun && model !== "reference" && (
        <>
          <Text style={styles.small}>
            {selectedRun.returnedModel} · {selectedRun.recordedAt}
          </Text>
          {Platform.OS === "web" && (
            <details>
              <summary>Original model response</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{selectedRun.raw}</pre>
            </details>
          )}
        </>
      )}
    </View>
  );
}
