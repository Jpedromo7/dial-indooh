"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionDto } from "@dialindooh/shared";
import { ApiClientError, apiClient } from "@/lib/api-client";

interface SessionContextValue {
  session: SessionDto | null;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({ session: null, refresh: async () => undefined });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionDto | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSession(await apiClient.getSession());
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        router.replace("/login");
      }
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <SessionContext.Provider value={{ session, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
