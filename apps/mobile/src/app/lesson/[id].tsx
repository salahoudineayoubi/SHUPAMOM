import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { AttemptResult, LessonDetail } from "@shupamom/shared";
import { Button, Card, ErrorState, Loading, PhraseCard, PlaceholderBanner, ProgressBar, Screen, T } from "../../components/ui";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { colors, radius, space } from "../../theme";

type Stage = { kind: "learn"; index: number } | { kind: "exercise"; index: number } | { kind: "result"; result: AttemptResult };

/** A mission: learn the phrases (text + translation + audio), then exercises, then the result. */
export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "learn", index: 0 });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setError(null);
    api.lesson(id).then(setLesson).catch((e) => setError(e.message));
  };
  useEffect(load, [id]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!lesson) return <Loading />;
  if (lesson.phrases.length === 0) return <ErrorState message="Cette mission n'a pas encore de contenu validé." />;

  const steps = lesson.phrases.length + lesson.exercises.length;
  const position = stage.kind === "learn" ? stage.index : stage.kind === "exercise" ? lesson.phrases.length + stage.index : steps;

  const submit = async (final: Record<string, string>) => {
    setSubmitting(true);
    try {
      const result = await api.attempt(lesson.id, {
        answers: Object.entries(final).map(([exerciseId, optionId]) => ({ exerciseId, optionId })),
      });
      setStage({ kind: "result", result });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ProgressBar value={position} total={steps} />
      {lesson.containsPlaceholder ? <PlaceholderBanner /> : null}

      {stage.kind === "learn" && (
        <>
          <T variant="label">Apprendre · {stage.index + 1}/{lesson.phrases.length}</T>
          <T variant="title">{lesson.title}</T>
          <PhraseCard phrase={lesson.phrases[stage.index]} />
          <View style={{ flex: 1 }} />
          <Button
            title={stage.index < lesson.phrases.length - 1 ? "Suivant" : lesson.exercises.length ? "Je m'entraîne" : "Terminer"}
            onPress={() =>
              stage.index < lesson.phrases.length - 1
                ? setStage({ kind: "learn", index: stage.index + 1 })
                : lesson.exercises.length
                  ? setStage({ kind: "exercise", index: 0 })
                  : router.back()
            }
          />
        </>
      )}

      {stage.kind === "exercise" &&
        (() => {
          const ex = lesson.exercises[stage.index];
          const chosen = answers[ex.id];
          const isLast = stage.index === lesson.exercises.length - 1;
          return (
            <>
              <T variant="label">Exercice · {stage.index + 1}/{lesson.exercises.length}</T>
              <T variant="title">{ex.prompt}</T>
              <View style={{ gap: space(3) }}>
                {ex.options.map((o) => {
                  const selected = chosen === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setAnswers({ ...answers, [ex.id]: o.id })}
                      style={({ pressed }) => ({
                        padding: space(4),
                        borderRadius: radius.md,
                        borderWidth: 2,
                        borderColor: selected ? colors.purple : colors.line,
                        backgroundColor: selected ? colors.purpleSoft : colors.white,
                        opacity: pressed ? 0.9 : 1,
                        minHeight: 60,
                        justifyContent: "center",
                      })}
                    >
                      <T variant="subtitle">{o.label}</T>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flex: 1 }} />
              <Button
                title={isLast ? "Valider mes réponses" : "Suivant"}
                disabled={!chosen}
                loading={submitting}
                onPress={() => (isLast ? submit(answers) : setStage({ kind: "exercise", index: stage.index + 1 }))}
              />
            </>
          );
        })()}

      {stage.kind === "result" && (
        <>
          <Card style={{ alignItems: "center", gap: space(2) }}>
            <T style={{ fontSize: 52 }}>{stage.result.score >= 70 ? "🎉" : "💪"}</T>
            <T variant="display" style={{ color: colors.purple }}>
              {stage.result.score}%
            </T>
            <T variant="subtitle">
              {stage.result.correct} bonne{stage.result.correct > 1 ? "s" : ""} réponse{stage.result.correct > 1 ? "s" : ""} sur {stage.result.total}
            </T>
            <T style={{ textAlign: "center", color: colors.muted }}>
              {stage.result.lessonCompleted ? "Mission réussie ! Ta grand-mère serait fière de toi." : "Encore un petit effort : refais la mission pour la valider."}
            </T>
          </Card>
          <Card>
            <T variant="subtitle">Ton parcours</T>
            <View style={{ marginVertical: space(2) }}>
              <ProgressBar value={stage.result.pathProgress.completed} total={stage.result.pathProgress.total} />
            </View>
            <T variant="caption">
              {stage.result.pathProgress.completed} mission(s) sur {stage.result.pathProgress.total}
            </T>
          </Card>
          {user?.isGuest ? (
            <Card style={{ backgroundColor: colors.goldSoft, borderColor: colors.gold }}>
              <T variant="subtitle">Garde tes progrès</T>
              <T variant="caption" style={{ marginBottom: space(3) }}>
                Crée ton compte gratuit pour continuer à apprendre chez toi.
              </T>
              <Button title="Créer mon compte" onPress={() => router.push("/auth")} />
            </Card>
          ) : null}
          <Button title="Retour à l'accueil" variant="ghost" onPress={() => router.replace("/home")} />
          {!stage.result.lessonCompleted ? (
            <Button
              title="Recommencer"
              onPress={() => {
                setAnswers({});
                setStage({ kind: "learn", index: 0 });
              }}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}
