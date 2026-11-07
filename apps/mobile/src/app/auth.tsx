import { useCallback, useState } from "react";
import { TextInput, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Button, Card, Screen, T } from "../components/ui";
import { GoogleButton } from "../components/google-button";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { colors, fonts, radius, space } from "../theme";

/**
 * Compte: Google (priority, same as KolayExpress) or e-mail. A guest who signs up or
 * signs in with Google keeps the progress made during the demo (upgraded server-side).
 */
export default function Auth() {
  const { user, setUser, logout } = useSession();
  const [mode, setMode] = useState<"register" | "login">(user?.isGuest ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = useCallback(
    (u: Awaited<ReturnType<typeof api.me>>) => {
      setUser(u);
      router.replace(u.onboarded ? "/home" : "/onboarding");
    },
    [setUser]
  );

  const onGoogle = useCallback(async (idToken: string) => done(await api.google(idToken)), [done]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      done(mode === "register" ? await api.register(email, password, name || "Apprenant") : await api.login(email, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue");
    } finally {
      setBusy(false);
    }
  };

  if (user && !user.isGuest) {
    return (
      <Screen>
        <Card>
          <T variant="label">Connecté</T>
          <T variant="title">{user.displayName}</T>
          <T variant="caption">{user.email}</T>
        </Card>
        <Button
          title="Se déconnecter"
          variant="ghost"
          onPress={async () => {
            await logout();
            router.replace("/");
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <T variant="title">{mode === "register" ? "Crée ton compte" : "Connexion"}</T>
      <T variant="caption">
        {user?.isGuest ? "Tes progrès de la démo seront conservés." : "Retrouve ta progression sur tous tes appareils."}
      </T>

      <GoogleButton onIdToken={onGoogle} />

      <View style={styles.sep}>
        <View style={styles.line} />
        <T variant="caption">ou avec ton e-mail</T>
        <View style={styles.line} />
      </View>

      {mode === "register" ? (
        <TextInput style={styles.input} placeholder="Ton prénom" placeholderTextColor={colors.muted} value={name} onChangeText={setName} autoComplete="given-name" />
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder={mode === "register" ? "Mot de passe (10 caractères, lettres et chiffres)" : "Mot de passe"}
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === "register" ? "new-password" : "current-password"}
      />
      {error ? <T style={{ color: colors.danger }}>{error}</T> : null}
      <Button title={mode === "register" ? "Créer mon compte" : "Me connecter"} onPress={submit} loading={busy} disabled={!email || !password} />
      <Button
        title={mode === "register" ? "J'ai déjà un compte" : "Je n'ai pas de compte"}
        variant="ghost"
        onPress={() => setMode(mode === "register" ? "login" : "register")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: space(4),
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  sep: { flexDirection: "row", alignItems: "center", gap: space(3) },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
});
