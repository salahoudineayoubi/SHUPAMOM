import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Constants from "expo-constants";
import { T } from "./ui";
import { colors } from "../theme";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: string }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("Google indisponible")));
    if (!existing) {
      s.src = GIS_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

/**
 * Web Google Sign-In — Google Identity Services button (same approach as the KolayExpress
 * web app's @react-oauth/google). The returned ID token is verified by the API.
 */
export function GoogleButton({ onIdToken }: { onIdToken: (idToken: string) => Promise<void> }) {
  const ref = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        const el = ref.current;
        if (cancelled || !el || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: (r) => {
            if (!r.credential) return setError("Connexion Google annulée");
            onIdToken(r.credential).catch((e) => setError(e instanceof Error ? e.message : "Connexion Google impossible"));
          },
        });
        window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", shape: "pill", text: "continue_with", locale: "fr", width: 320 });
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, onIdToken]);

  if (!clientId) return null;
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View ref={ref as never} />
      {error ? <T style={{ color: colors.danger }}>{error}</T> : null}
    </View>
  );
}
