import {
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { Button, PriceControl } from "./controls";
import { issues, type EditableItem } from "./menu";
import { closestDish } from "./matching";
import { styles } from "./styles";

type Props = {
  item: EditableItem;
  index: number;
  busy: boolean;
  currency: string;
  catalogDishes: { name: string; category: string }[];
  artwork: (item: {
    name: string;
    photo?: string | null;
  }) => ImageSourcePropType | undefined;
  change: (index: number, update: Partial<EditableItem>) => void;
  attachPhoto: (index: number) => void;
  onRemove: () => void;
};

export function DishEditor({
  item,
  index,
  busy,
  currency,
  catalogDishes,
  artwork,
  change,
  attachPhoto,
  onRemove,
}: Props) {
  const incomplete = issues([item]) > 0;
  const score = item.confidence;
  const hue = incomplete
    ? 8
    : item.verified
      ? 135
      : score == null
        ? 40
        : Math.round(10 + score * 0.78);
  const label = incomplete
    ? "Needs correction"
    : item.verified
      ? "Verified by you"
      : score == null
        ? "Ready to review"
        : "Check against the photo";
  return (
    <View
      key={index}
      style={[
        styles.card,
        {
          backgroundColor: `hsl(${hue}, 68%, 97%)`,
          borderLeftWidth: 5,
          borderLeftColor: `hsl(${hue}, 55%, 39%)`,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          marginBottom: 12,
        }}
      >
        {artwork(item) && (
          <Image
            source={artwork(item)}
            accessibilityLabel={
              item.photo
                ? "Uploaded dish photo"
                : "Catalog illustration of " + item.name
            }
            resizeMode="cover"
            style={{ width: 100, height: 76, borderRadius: 10 }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.menuName}>{item.name || "New dish"}</Text>
          <Text style={styles.small}>
            {item.photo
              ? "Your dish photo"
              : artwork(item)
                ? "Catalog illustration"
                : "Photo optional"}
          </Text>
        </View>
      </View>
      <Text style={styles.label}>
        {label}
        {score != null ? ` · AI estimate for original scan: ${score}%` : ""}
      </Text>
      {!incomplete && !item.verified && (
        <Button
          secondary
          title="Mark as verified"
          disabled={busy}
          onPress={() => change(index, { verified: true })}
        />
      )}
      <Button
        secondary
        disabled={busy}
        title={item.photo ? "Replace dish photo" : "Add dish photo"}
        onPress={() => attachPhoto(index)}
      />
      <View style={styles.headingRow}>
        <Text style={styles.small}>
          DISH {String(index + 1).padStart(2, "0")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove dish ${index + 1}`}
          disabled={busy}
          onPress={onRemove}
        >
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>
      {(() => {
        const candidate = closestDish(item.name, catalogDishes);
        if (
          !candidate ||
          (candidate.name === item.name && candidate.category === item.category)
        )
          return null;
        return (
          <Button
            secondary
            disabled={busy}
            title={`Use catalog match: ${candidate.name} · ${candidate.category}`}
            onPress={() =>
              change(index, {
                name: candidate.name,
                category: candidate.category,
              })
            }
          />
        );
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
        <View style={{ minWidth: 170, flexGrow: 1 }}>
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
            onPress={() => change(index, { vegetarian: choice.value })}
            style={[
              styles.choice,
              item.vegetarian === choice.value && styles.selected,
            ]}
          >
            <Text
              style={{
                color: item.vegetarian === choice.value ? "#fff" : "#252321",
              }}
            >
              {choice.value === null
                ? "Unspecified"
                : choice.value
                  ? "Veg"
                  : "Non-veg"}
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
  );
}
