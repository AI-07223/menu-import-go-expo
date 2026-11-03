import { Pressable, Text, TextInput, View } from "react-native";
import { parsePrice, priceText } from "./menu";
import { styles } from "./styles";

export function Button({
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
      style={({ pressed }) => [
        pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
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
export function PriceControl({
  label,
  value,
  onChange,
  busy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
}) {
  const amount = parsePrice(value);
  function step(delta: number, symbol: string) {
    const next = (amount ?? 0) + delta;
    const disabled =
      busy ||
      next <= 0 ||
      next > 9999999 ||
      (amount === null && value.trim() !== "");
    const direction = delta > 0 ? "increase" : "decrease";
    const units = Math.abs(delta) === 100 ? "one" : "ten";
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + ", " + direction + " by " + units}
        disabled={disabled}
        onPress={() => onChange(priceText(next))}
        style={[styles.step, disabled && { opacity: 0.4 }]}
      >
        <Text style={styles.stepText}>{symbol}</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 5 }}>
      <TextInput
        accessibilityLabel={label}
        editable={!busy}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
        style={styles.input}
      />
      <View style={styles.stepper}>
        {step(-1000, "−10")}
        {step(-100, "−1")}
        {step(100, "+1")}
        {step(1000, "+10")}
      </View>
    </View>
  );
}
