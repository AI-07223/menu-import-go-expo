import { Image, Text, View, type ImageSourcePropType } from "react-native";
import { priceText, type SavedMenu } from "./menu";
import { styles } from "./styles";

type Props = {
  dishWidth: "32%" | "49%" | "100%";
  saved: SavedMenu[];
  demoSaved: SavedMenu[];
  artwork: (item: {
    name: string;
    photo?: string | null;
  }) => ImageSourcePropType | undefined;
};

export function SavedMenus({ saved, demoSaved, artwork, dishWidth }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>SAVED MENUS</Text>
      <Text style={styles.heading}>Saved menus</Text>
      <Text style={styles.small}>
        Demo saves stay in this browser. Restaurant menus require an operator
        token.
      </Text>
      {!saved.length && !demoSaved.length ? (
        <Text style={styles.small}>
          Your verified menus will appear here after you save your first import.
        </Text>
      ) : (
        [
          ...demoSaved.map((entry) => ({
            entry,
            origin: "Demo · this browser",
          })),
          ...saved.map((entry) => ({ entry, origin: "Restaurant · server" })),
        ].map(({ entry, origin }) => (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.menuName}>{entry.name}</Text>
            <Text style={styles.small}>{origin}</Text>
            <Text style={styles.small}>
              {entry.items.length} dishes · {entry.currency}
            </Text>
            <View style={styles.dishGrid}>
            {entry.items.map((item, i) => (
              <View key={i} style={[styles.savedRow, { width: dishWidth, flexWrap: "wrap" }]}>
                {artwork(item) && (
                  <Image
                    source={artwork(item)}
                    accessibilityLabel={"Photo for " + item.name}
                    style={{ width: 72, height: 56, borderRadius: 8 }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.dishName}>{item.name}</Text>
                  <Text style={styles.small}>
                    {item.category} ·{" "}
                    {item.vegetarian === null
                      ? "Unspecified"
                      : item.vegetarian
                        ? "Vegetarian"
                        : "Non-vegetarian"}
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
          </View>
        ))
      )}
    </View>
  );
}
