import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { SessionProvider, useSession } from "../lib/session";
import { colors } from "../theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Root() {
  const { ready } = useSession();
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  const done = ready && fontsLoaded;
  useEffect(() => {
    if (done) SplashScreen.hideAsync().catch(() => undefined);
  }, [done]);
  if (!done) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.ivory },
          headerTintColor: colors.purple,
          headerTitleStyle: { fontFamily: "Poppins_600SemiBold" },
          contentStyle: { backgroundColor: colors.ivory },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: "Bienvenue" }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="path/[slug]" options={{ title: "Parcours" }} />
        <Stack.Screen name="lesson/[id]" options={{ title: "Mission" }} />
        <Stack.Screen name="auth" options={{ title: "Mon compte" }} />
        <Stack.Screen name="dictionary" options={{ title: "Dictionnaire" }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
