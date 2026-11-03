import { Image, Text, TextInput, View } from "react-native";
import { Button } from "./controls";
import { styles } from "./styles";

type Props = {
  source: string;
  token: string;
  busy: boolean;
  onContinue: () => void;
  onDiscard: () => void;
  onTokenChange: (value: string) => void;
  onUpload: () => void;
  onExamples: () => void;
  onSaved: () => void;
};

export function ImportScreen({
  source,
  token,
  busy,
  onContinue,
  onDiscard,
  onTokenChange,
  onUpload,
  onExamples,
  onSaved,
}: Props) {
  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>THE RESTAURANT WORKSPACE</Text>
        <Text style={styles.title}>Import your menu with confidence.</Text>
        <Text style={styles.subtitle}>
          Based on a menu import workflow in my Billing project, this sample
          combines AI extraction with a catalog of common dishes and images. It
          suggests close matches for misread names, then lets restaurant owners
          review and correct every detail before saving. Large menus become
          easier to import and verify.
        </Text>
      </View>
      {source ? (
        <View style={{ gap: 8 }}>
          <Button title="Continue verifying draft" onPress={onContinue} />
          <Button
            secondary
            title="Discard draft"
            disabled={busy}
            onPress={onDiscard}
          />
        </View>
      ) : null}
      <View style={styles.access}>
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
          onChangeText={onTokenChange}
          placeholder="Enter your operator token"
          autoCapitalize="none"
        />
      </View>
      <View style={styles.homeGrid}>
        <View testID="home-card" style={styles.homeCard}>
          <Image
            source={require("../assets/home-scan.png")}
            accessibilityLabel="Import a menu photo"
            resizeMode="cover"
            style={styles.cover}
          />
          <View style={styles.cardBody}>
            <Text style={styles.eyebrow}>01 / IMPORT</Text>
            <Text style={styles.cardTitle}>Import a menu</Text>
            <Text style={[styles.small, { flex: 1 }]}>
              Upload a menu photo using your configured server. Set
              OPENROUTER_API_KEY in the server’s .env file to enable live scans.
            </Text>
            <Button
              title={busy ? "Working…" : "Upload menu photo"}
              onPress={onUpload}
              disabled={busy || !token}
            />
          </View>
        </View>
        <View testID="home-card" style={styles.homeCard}>
          <Image
            source={require("../assets/home-compare.png")}
            accessibilityLabel="Recorded menu examples"
            resizeMode="cover"
            style={styles.cover}
          />
          <View style={styles.cardBody}>
            <Text style={styles.eyebrow}>02 / EXPLORE</Text>
            <Text style={styles.cardTitle}>Recorded demos</Text>
            <Text style={[styles.small, { flex: 1 }]}>
              Explore three recorded menus and compare model output.
            </Text>
            <Button
              title="Open menu demos"
              disabled={busy}
              onPress={onExamples}
            />
          </View>
        </View>
      </View>
      <Button
        secondary
        title="View saved menus"
        disabled={busy}
        onPress={onSaved}
      />
    </>
  );
}
