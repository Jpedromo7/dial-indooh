"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, getApiErrorMessage } from "@/lib/api-client";

interface RefreshOptions {
  silent?: boolean;
}

export function useApiQuery<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (options: RefreshOptions = {}) => {
    if (!options.silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      setData(await loader());
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        router.replace("/login");
        return;
      }

      setError(getApiErrorMessage(requestError));
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }, dependencies);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, isLoading, refresh: load, setData };
}
