"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SessionDto } from "@dialindooh/shared";
import { ApiClientError, apiClient } from "@/lib/api-client";

interface SessionContextValue {
  session: SessionDto | null;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({ session: null, refresh: async () => undefined });
const PUBLIC_PATHS = ["/login"];

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionDto | null>(null);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  const refresh = useCallback(async () => {
    try {
      setSession(await apiClient.getSession());
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        setSession(null);
        if (!PUBLIC_PATHS.includes(window.location.pathname)) router.replace("/login");
      }
    }
  }, [router]);

  useEffect(() => {
    if (isPublic) {
      setSession(null);
      return;
    }

    if (!session) {
      void refresh();
    }
  }, [isPublic, refresh, session]);

  return <SessionContext.Provider value={{ session, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
