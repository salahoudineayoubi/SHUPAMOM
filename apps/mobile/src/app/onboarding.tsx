import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import type { Goal } from "@shupamom/shared";
import { Button, Choice, ProgressBar, Screen, T } from "../components/ui";
import { useSession } from "../lib/session";
import { colors, space } from "../theme";

type Level = "debutant" | "quelques_mots" | "intermediaire";

const STEPS = 4;

/** Onboarding in 4 steps: je parle / je veux apprendre / mon niveau / pourquoi. */
export default function Onboarding() {
  const { onboard } = useSession();
  const [step, setStep] = useState(0);
  const [native, setNative] = useState("fr");
  const [learning, setLearning] = useState("bax");
  const [level, setLevel] = useState<Level | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canNext = [Boolean(native), Boolean(learning), Boolean(level), Boolean(goal)][step];

  const next = async () => {
    if (step < STEPS - 1) return setStep(step + 1);
    setBusy(true);
    setError(null);
    try {
      await onboard({ nativeLanguage: native, learningLanguage: learning, level: level!, goal: goal! });
      router.replace("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: space(2) }}>
        <T variant="caption">
          Étape {step + 1} sur {STEPS}
        </T>
        <ProgressBar value={step + 1} total={STEPS} />
      </View>

      {step === 0 && (
        <>
          <T variant="title">Je parle…</T>
          <Choice label="Français" selected={native === "fr"} onPress={() => setNative("fr")} />
          <T variant="caption">D'autres langues d'explication arriveront bientôt (anglais…).</T>
        </>
      )}

      {step === 1 && (
        <>
          <T variant="title">Je veux apprendre…</T>
          <Choice label="Shüpamom (bamoun)" hint="Langue du peuple bamoun — Foumban, Noun" selected={learning === "bax"} onPress={() => setLearning("bax")} />
          <T variant="caption">D'autres langues africaines suivront.</T>
        </>
      )}

      {step === 2 && (
        <>
          <T variant="title">Mon niveau</T>
          <Choice label="Je débute" hint="Je ne connais presque aucun mot" selected={level === "debutant"} onPress={() => setLevel("debutant")} />
          <Choice label="Je connais quelques mots" hint="Je comprends des salutations" selected={level === "quelques_mots"} onPress={() => setLevel("quelques_mots")} />
          <Choice label="Je me débrouille" hint="Je comprends mais je parle peu" selected={level === "intermediaire"} onPress={() => setLevel("intermediaire")} />
        </>
      )}

      {step === 3 && (
        <>
          <T variant="title">Pourquoi veux-tu apprendre ?</T>
          <Choice label="Parler avec mes parents et grands-parents" selected={goal === "famille"} onPress={() => setGoal("famille")} />
          <Choice label="Retrouver mes racines et ma culture" selected={goal === "racines"} onPress={() => setGoal("racines")} />
          <Choice label="Préparer un voyage au village" selected={goal === "voyage"} onPress={() => setGoal("voyage")} />
          <Choice label="Parler couramment" selected={goal === "courant"} onPress={() => setGoal("courant")} />
        </>
      )}

      <View style={{ flex: 1 }} />
      {error ? <T style={{ color: colors.danger }}>{error}</T> : null}
      <View style={{ flexDirection: "row", gap: space(3) }}>
        {step > 0 ? <Button title="Retour" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        <Button title={step === STEPS - 1 ? "C'est parti" : "Continuer"} onPress={next} disabled={!canNext} loading={busy} style={{ flex: 2 }} />
      </View>
    </Screen>
  );
}
