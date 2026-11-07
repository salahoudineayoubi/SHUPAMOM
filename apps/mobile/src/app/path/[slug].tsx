import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { PathDetail } from "@shupamom/shared";
import { ErrorState, Loading, ProgressBar, Screen, T } from "../../components/ui";
import { api } from "../../lib/api";
import { colors, radius, space } from "../../theme";

export default function PathScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [path, setPath] = useState<PathDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    api.path(slug).then(setPath).catch((e) => setError(e.message));
  }, [slug]);
  useFocusEffect(load);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!path) return <Loading />;

  return (
    <Screen>
      <T variant="title">{path.title}</T>
      <ProgressBar value={path.completedCount} total={path.lessonCount} />
      <View style={{ gap: space(3) }}>
        {path.lessons.map((l, i) => (
          <Pressable
            key={l.id}
            onPress={() => router.push(`/lesson/${l.id}`)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: space(4),
              alignItems: "center",
              padding: space(4),
              borderRadius: radius.md,
              backgroundColor: colors.white,
              borderWidth: 1.5,
              borderColor: l.completed ? colors.gold : colors.line,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: l.completed ? colors.gold : colors.purpleSoft,
              }}
            >
              <T variant="subtitle" style={{ color: colors.purpleDeep }}>
                {l.completed ? "✓" : i + 1}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="subtitle">{l.title}</T>
              <T variant="caption">
                {l.objective} · {l.estimatedMinutes} min{l.bestScore != null ? ` · meilleur score ${l.bestScore}%` : ""}
              </T>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
