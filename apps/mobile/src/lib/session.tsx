import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Me, OnboardingInput } from "@shupamom/shared";
import { api, refresh } from "./api";

type Session = {
  ready: boolean;
  user: Me | null;
  /** Starts the no-account demo (festival QR code). */
  startAsGuest: () => Promise<Me>;
  setUser: (u: Me) => void;
  onboard: (input: OnboardingInput) => Promise<Me>;
  logout: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Me | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (await refresh()) setUser(await api.me());
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const startAsGuest = useCallback(async () => {
    const u = user ?? (await api.guest());
    setUser(u);
    return u;
  }, [user]);

  const onboard = useCallback(async (input: OnboardingInput) => {
    const u = await api.onboard(input);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ ready, user, startAsGuest, setUser, onboard, logout }), [ready, user, startAsGuest, onboard, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}
