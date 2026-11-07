import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { PathDetail } from "@shupamom/shared";
import { Button, Card, ErrorState, Loading, Logo, ProgressBar, Screen, T } from "../components/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { colors, radius, space } from "../theme";

const FLAGSHIP = "parler-a-ma-grand-mere";
const GOAL_LABEL: Record<string, string> = {
  famille: "Parler avec ta famille",
  racines: "Retrouver tes racines",
  voyage: "Préparer ton voyage au village",
  courant: "Parler couramment",
};

/** Tableau de bord: mission du jour + progression. */
export default function Home() {
  const { user } = useSession();
  const [path, setPath] = useState<PathDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.path(FLAGSHIP).then(setPath).catch((e) => setError(e.message));
  }, []);
  useFocusEffect(load);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!path) return <Loading />;

  const nextLesson = path.lessons.find((l) => !l.completed) ?? path.lessons[0];
  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Logo width={170} />
        <Pressable onPress={() => router.push(user?.isGuest ? "/auth" : "/auth")} accessibilityRole="button">
          <T variant="caption" style={{ color: colors.purple }}>
            {user?.isGuest ? "Créer mon compte" : user?.displayName}
          </T>
        </Pressable>
      </View>

      <View>
        <T variant="label">Ton objectif</T>
        <T variant="title">{GOAL_LABEL[user?.goal ?? "famille"]}</T>
      </View>

      <Card style={{ backgroundColor: colors.purple, borderColor: colors.purple }}>
        <T variant="label" style={{ color: colors.gold }}>
          Mission du jour
        </T>
        <T variant="title" style={{ color: colors.white, marginTop: space(1) }}>
          {nextLesson?.title}
        </T>
        <T style={{ color: "#E9D9F5", marginTop: space(1) }}>
          {nextLesson?.objective} · {nextLesson?.estimatedMinutes} min
        </T>
        <Button title="Commencer la mission" variant="gold" style={{ marginTop: space(4) }} onPress={() => router.push(`/lesson/${nextLesson.id}`)} />
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: space(2) }}>
          <T variant="subtitle">{path.title}</T>
          <T variant="caption">
            {path.completedCount}/{path.lessonCount}
          </T>
        </View>
        <ProgressBar value={path.completedCount} total={path.lessonCount} />
        <Button title="Voir le parcours" variant="ghost" style={{ marginTop: space(4) }} onPress={() => router.push(`/path/${path.slug}`)} />
      </Card>

      <Pressable onPress={() => router.push("/dictionary")} style={{ padding: space(4), borderRadius: radius.md, backgroundColor: colors.goldSoft }} accessibilityRole="button">
        <T variant="subtitle">📖 Dictionnaire français → shüpamom</T>
        <T variant="caption">Cherche une expression dans le corpus bamoun–français</T>
      </Pressable>
    </Screen>
  );
}
