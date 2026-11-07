import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type {
  AttemptInput,
  AttemptResult,
  AuthResponse,
  DictionaryResult,
  LessonDetail,
  Me,
  OnboardingInput,
  PathDetail,
  PathSummary,
} from "@shupamom/shared";

/**
 * Typed API client. Tokens:
 * - native: access + refresh in SecureStore (refresh sent in the body, header x-client: native);
 * - web: access in memory, refresh in an httpOnly cookie set by the API (never readable by JS).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
const isWeb = Platform.OS === "web";
const KEY_REFRESH = "shupamom.refresh";

let accessToken: string | null = null;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function storeRefresh(token?: string) {
  if (isWeb || !token) return;
  await SecureStore.setItemAsync(KEY_REFRESH, token);
}
async function readRefresh() {
  return isWeb ? null : SecureStore.getItemAsync(KEY_REFRESH);
}
export async function clearSession() {
  accessToken = null;
  if (!isWeb) await SecureStore.deleteItemAsync(KEY_REFRESH);
}

async function raw<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json", ...(init.headers as Record<string, string>) };
  if (!isWeb) headers["x-client"] = "native";
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError(0, "OFFLINE", "Pas de connexion. Vérifie ton réseau et réessaie.");
  }
  if (res.status === 401 && retry && !path.startsWith("/v1/auth/")) {
    if (await refresh()) return raw<T>(path, init, false);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? "HTTP_ERROR", body?.error?.message ?? "Une erreur est survenue");
  return body as T;
}

async function applyAuth(r: AuthResponse) {
  accessToken = r.tokens.accessToken;
  await storeRefresh(r.tokens.refreshToken);
  return r.user;
}

/** Restores a session from the stored refresh token (native) or cookie (web). */
export async function refresh(): Promise<boolean> {
  const token = await readRefresh();
  if (!isWeb && !token) return false;
  try {
    const out = await raw<{ accessToken: string; refreshToken?: string }>(
      "/v1/auth/refresh",
      { method: "POST", body: JSON.stringify(token ? { refreshToken: token } : {}) },
      false
    );
    accessToken = out.accessToken;
    await storeRefresh(out.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  guest: async () => applyAuth(await raw<AuthResponse>("/v1/auth/guest", { method: "POST" })),
  login: async (email: string, password: string) =>
    applyAuth(await raw<AuthResponse>("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })),
  register: async (email: string, password: string, displayName: string) =>
    applyAuth(await raw<AuthResponse>("/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password, displayName }) })),
  google: async (idToken: string) => applyAuth(await raw<AuthResponse>("/v1/auth/google", { method: "POST", body: JSON.stringify({ idToken }) })),
  logout: async () => {
    const token = await readRefresh();
    await raw<void>("/v1/auth/logout", { method: "POST", body: JSON.stringify(token ? { refreshToken: token } : {}) }).catch(() => undefined);
    await clearSession();
  },
  me: () => raw<Me>("/v1/me"),
  onboard: (input: OnboardingInput) => raw<Me>("/v1/me", { method: "PATCH", body: JSON.stringify(input) }),
  paths: () => raw<PathSummary[]>("/v1/paths?lang=bax"),
  path: (slug: string) => raw<PathDetail>(`/v1/paths/${encodeURIComponent(slug)}`),
  lesson: (id: string) => raw<LessonDetail>(`/v1/lessons/${encodeURIComponent(id)}`),
  attempt: (id: string, input: AttemptInput) =>
    raw<AttemptResult>(`/v1/lessons/${encodeURIComponent(id)}/attempts`, { method: "POST", body: JSON.stringify(input) }),
  dictionary: (q: string) => raw<DictionaryResult>(`/v1/dictionary?q=${encodeURIComponent(q)}`),
};
