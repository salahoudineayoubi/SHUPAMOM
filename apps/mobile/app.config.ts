import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Extends app.json with values that come from the environment (never commit secrets):
 *   EXPO_PUBLIC_API_URL                 API base URL
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID    Google OAuth "Web" client id (web button + native webClientId)
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID    Google OAuth iOS client id
 *   GOOGLE_IOS_URL_SCHEME               reversed iOS client id (com.googleusercontent.apps.xxx)
 * The Google Sign-In native plugin is only added when its iOS URL scheme is configured.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];
  if (process.env.GOOGLE_IOS_URL_SCHEME) {
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME }]);
  }
  return {
    ...(config as ExpoConfig),
    plugins,
    extra: {
      ...config.extra,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
    },
  };
};
