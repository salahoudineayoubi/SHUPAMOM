import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useAudioPlayer } from "expo-audio";
import { PLACEHOLDER_BANNER_FR, type PhraseDto } from "@shupamom/shared";
import { colors, fonts, radius, shadow, space } from "../theme";

// ── Typography ───────────────────────────────────────────────────────────────
type Variant = "display" | "title" | "subtitle" | "body" | "caption" | "label";
const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38, color: colors.purpleDeep },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, color: colors.purpleDeep },
  subtitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.ink },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.purple, letterSpacing: 1.2, textTransform: "uppercase" },
};
export function T({ variant = "body", style, ...p }: TextProps & { variant?: Variant }) {
  return <Text {...p} style={[variantStyle[variant], style]} />;
}

// ── Layout ───────────────────────────────────────────────────────────────────
export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const inner = <View style={[styles.inner, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Logo({ width = 220 }: { width?: number }) {
  return (
    <Image
      source={require("../../assets/images/logo-horizontal.png")}
      style={{ width, height: width * (575 / 2200) }}
      contentFit="contain"
      accessibilityLabel="Shupamom"
    />
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────
type BtnProps = PressableProps & { title: string; variant?: "primary" | "gold" | "ghost"; loading?: boolean; style?: StyleProp<ViewStyle> };
export function Button({ title, variant = "primary", loading, disabled, style, ...p }: BtnProps) {
  const v = variant === "primary" ? styles.btnPrimary : variant === "gold" ? styles.btnGold : styles.btnGhost;
  const tv = variant === "ghost" ? styles.btnGhostText : variant === "gold" ? styles.btnGoldText : styles.btnText;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, v, (disabled || loading) && styles.btnDisabled, pressed && { opacity: 0.85 }, style]}
      {...p}
    >
      {loading ? <ActivityIndicator color={variant === "ghost" ? colors.purple : colors.white} /> : <Text style={tv}>{title}</Text>}
    </Pressable>
  );
}

export function Choice({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && { opacity: 0.9 }]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={{ flex: 1 }}>
        <T variant="subtitle">{label}</T>
        {hint ? <T variant="caption">{hint}</T> : null}
      </View>
    </Pressable>
  );
}

// ── States ───────────────────────────────────────────────────────────────────
export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.purple} />
      <T variant="caption" style={{ marginTop: space(3) }}>
        {label}
      </T>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <T variant="subtitle" style={{ textAlign: "center", marginBottom: space(4) }}>
        {message}
      </T>
      {onRetry ? <Button title="Réessayer" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

/** Mandatory on any non-validated Bamoun content (docs/ARCHITECTURE.md — règle d'or). */
export function PlaceholderBanner() {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <T style={styles.bannerText}>⚠️ {PLACEHOLDER_BANNER_FR}</T>
    </View>
  );
}

export function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: value }}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

// ── Audio + phrase ───────────────────────────────────────────────────────────
export function AudioButton({ url, label = "Écouter" }: { url: string; label?: string }) {
  const player = useAudioPlayer(url);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={async () => {
        await player.seekTo(0);
        player.play();
      }}
      style={({ pressed }) => [styles.audio, pressed && { transform: [{ scale: 0.96 }] }]}
    >
      <Text style={styles.audioIcon}>▶</Text>
    </Pressable>
  );
}

export function PhraseCard({ phrase }: { phrase: PhraseDto }) {
  return (
    <Card style={phrase.isPlaceholder ? { borderColor: colors.gold, borderWidth: 1 } : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
        <View style={{ flex: 1 }}>
          <T variant="label">Shüpamom</T>
          <T variant="title" style={{ marginTop: space(1) }}>
            {phrase.text}
          </T>
          {phrase.translation ? (
            <T variant="body" style={{ color: colors.muted, marginTop: space(1) }}>
              {phrase.translation}
            </T>
          ) : null}
        </View>
        {phrase.audioUrl ? <AudioButton url={phrase.audioUrl} /> : null}
      </View>
      {phrase.usageNote ? (
        <T variant="caption" style={{ marginTop: space(2) }}>
          💡 {phrase.usageNote}
        </T>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  scroll: { flexGrow: 1 },
  inner: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center", padding: space(5), gap: space(4) },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space(5), borderWidth: 1, borderColor: colors.line, ...shadow },
  btn: { minHeight: 54, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: space(6) },
  btnPrimary: { backgroundColor: colors.purple },
  btnGold: { backgroundColor: colors.gold },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.purple },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 16 },
  btnGoldText: { color: colors.purpleDeep, fontFamily: fonts.semibold, fontSize: 16 },
  btnGhostText: { color: colors.purple, fontFamily: fonts.semibold, fontSize: 16 },
  choice: { flexDirection: "row", alignItems: "center", gap: space(3), padding: space(4), borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, minHeight: 64 },
  choiceSelected: { borderColor: colors.purple, backgroundColor: colors.purpleSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.purple },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.purple },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space(8) },
  banner: { backgroundColor: colors.goldSoft, borderRadius: radius.sm, paddingVertical: space(2), paddingHorizontal: space(3), borderWidth: 1, borderColor: colors.gold },
  bannerText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.purpleDeep },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.purpleSoft, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.gold, borderRadius: 5 },
  audio: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  audioIcon: { color: colors.purpleDeep, fontSize: 20, marginLeft: 3 },
});
