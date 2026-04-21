import { API_BASE_URL, NETWORK_RETRY_ATTEMPTS } from "../config/appConfig";
import type { ActivationResponse, HeartbeatInput, ScreenCommand, ScreenEventInput, TvPlaylist } from "../types/signage";
import { sleep } from "../utils/sleep";

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function activateScreen(activationCode: string) {
  return request<ActivationResponse>("/screens/activate", {
    method: "POST",
    body: { activationCode }
  });
}

export async function fetchDevicePlaylist(screenId: string, deviceKey: string) {
  const response = await request<{ playlist: TvPlaylist | null }>(`/screens/${screenId}/playlist`, {
    headers: withDeviceKey(deviceKey)
  });

  return response.playlist;
}

export async function sendHeartbeat(screenId: string, deviceKey: string, input: HeartbeatInput) {
  return request(`/screens/${screenId}/heartbeat`, {
    method: "POST",
    headers: withDeviceKey(deviceKey),
    body: input
  });
}

export async function sendScreenEvent(screenId: string, deviceKey: string, input: ScreenEventInput) {
  return request(`/screens/${screenId}/events`, {
    method: "POST",
    headers: withDeviceKey(deviceKey),
    body: input
  });
}

export async function fetchScreenCommands(screenId: string, deviceKey: string) {
  return request<ScreenCommand[]>(`/screens/${screenId}/commands`, {
    headers: withDeviceKey(deviceKey)
  });
}

export async function acknowledgeScreenCommand(
  screenId: string,
  deviceKey: string,
  input: { commandId: string; status?: "acknowledged" | "failed"; errorMessage?: string | null }
) {
  return request(`/screens/${screenId}/commands/ack`, {
    method: "POST",
    headers: withDeviceKey(deviceKey),
    body: input
  });
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

      if (!response.ok || !payload?.ok) {
        throw new ApiError(payload?.error?.message ?? "Request failed", response.status, payload?.error?.code);
      }

      return payload.data as T;
    } catch (error) {
      lastError = error;

      if (attempt < NETWORK_RETRY_ATTEMPTS) {
        await sleep(700 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Network request failed");
}

function withDeviceKey(deviceKey: string) {
  return {
    "x-device-key": deviceKey,
    Authorization: `Bearer ${deviceKey}`
  };
}
