import { useEffect, useState } from "react";
import { TextInput, StyleSheet, View } from "react-native";
import type { PhraseDto } from "@shupamom/shared";
import { Loading, PhraseCard, Screen, T } from "../components/ui";
import { api } from "../lib/api";
import { colors, fonts, radius, space } from "../theme";

/** French → Shüpamom search over validated expressions only (no free machine translation). */
export default function Dictionary() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PhraseDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      api
        .dictionary(query)
        .then((r) => setResults(r.results))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Screen>
      <TextInput
        style={styles.input}
        placeholder="Cherche un mot en français (ex. : nom, enfant, merci)"
        placeholderTextColor={colors.muted}
        value={q}
        onChangeText={setQ}
        autoFocus
        accessibilityLabel="Rechercher dans le dictionnaire"
      />
      {loading ? <Loading label="Recherche…" /> : null}
      {error ? <T style={{ color: colors.danger }}>{error}</T> : null}
      {results && !loading ? (
        results.length === 0 ? (
          <T variant="caption">Aucune expression validée ne correspond encore. Le dictionnaire s'enrichit avec nos linguistes.</T>
        ) : (
          <View style={{ gap: space(3) }}>
            {results.map((p) => (
              <PhraseCard key={p.id} phrase={p} />
            ))}
          </View>
        )
      ) : null}
      <T variant="caption" style={{ marginTop: space(4) }}>
        Source : corpus bamoun–français de l'Institute of African Digital Humanities (A. S. Ntieche Fifen, E. Ngué Um) et contributions validées.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 54,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.purple,
    backgroundColor: colors.white,
    paddingHorizontal: space(5),
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
});
