import { useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { Button, T } from "./ui";
import { colors } from "../theme";

/**
 * Native Google Sign-In — same library and flow as KolayExpress (mobile/src/hooks/useGoogleLogin.js):
 * GoogleSignin.signIn() → ID token → POST /v1/auth/google (verified server-side).
 * Requires a development/production build (not Expo Go) and the Google client ids.
 */
export function GoogleButton({ onIdToken }: { onIdToken: (idToken: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const extra = (Constants.expoConfig?.extra ?? {}) as { googleWebClientId?: string; googleIosClientId?: string };
  const configured = Boolean(extra.googleWebClientId) && (Platform.OS === "android" || Boolean(extra.googleIosClientId));

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      // Loaded lazily so the app still runs in Expo Go / tests without the native module.
      const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = await import("@react-native-google-signin/google-signin");
      GoogleSignin.configure({ webClientId: extra.googleWebClientId, iosClientId: extra.googleIosClientId || undefined, offlineAccess: false });
      if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try {
        const res = await GoogleSignin.signIn();
        if (!isSuccessResponse(res)) return; // cancelled
        if (!res.data.idToken) throw new Error("Jeton Google manquant");
        await onIdToken(res.data.idToken);
      } catch (e) {
        if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return;
        if (isErrorWithCode(e) && e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error("Services Google Play indisponibles");
        throw e;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion Google impossible");
    } finally {
      setBusy(false);
    }
  };

  if (!configured) return null;
  return (
    <>
      <Button title="Continuer avec Google" variant="ghost" onPress={signIn} loading={busy} />
      {error ? <T style={{ color: colors.danger, textAlign: "center" }}>{error}</T> : null}
    </>
  );
}
