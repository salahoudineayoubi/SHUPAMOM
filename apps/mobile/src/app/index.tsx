import { useState } from "react";
import { View } from "react-native";
import { Redirect, router } from "expo-router";
import { Image } from "expo-image";
import { Button, Screen, T } from "../components/ui";
import { useSession } from "../lib/session";
import { colors, space } from "../theme";

/** Accueil — what a Nguon visitor sees after scanning the QR code. */
export default function Welcome() {
  const { user, startAsGuest } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Redirect href={user.onboarded ? "/home" : "/onboarding"} />;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await startAsGuest();
      router.replace("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de démarrer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ justifyContent: "center" }}>
      <View style={{ alignItems: "center", gap: space(5), paddingVertical: space(6) }}>
        <Image
          source={require("../../assets/images/splash-logo.png")}
          style={{ width: 230, height: 230 }}
          contentFit="contain"
          accessibilityLabel="Logo Shupamom : un grand-père, un enfant et une mère autour d'un livre"
        />
        <T variant="display" style={{ textAlign: "center" }}>
          Retrouve ta langue.{"\n"}
          <T variant="display" style={{ color: colors.gold }}>
            Reconnecte-toi à tes racines.
          </T>
        </T>
        <T style={{ textAlign: "center", color: colors.muted }}>
          Apprends le shüpamom (bamoun) pour parler avec ta famille, en quelques minutes par jour.
        </T>
      </View>
      <View style={{ gap: space(3) }}>
        <Button title="Commencer sans compte" onPress={start} loading={busy} />
        <Button title="J'ai déjà un compte" variant="ghost" onPress={() => router.push("/auth")} />
        {error ? <T style={{ color: colors.danger, textAlign: "center" }}>{error}</T> : null}
      </View>
      <T variant="caption" style={{ textAlign: "center", marginTop: space(4) }}>
        Apprends ta langue. Parle avec ta famille. Préserve tes racines.
      </T>
    </Screen>
  );
}
