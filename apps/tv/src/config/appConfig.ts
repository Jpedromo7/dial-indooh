import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as
  | {
      apiBaseUrl?: string;
      playlistRefreshMinutes?: number;
      heartbeatMinutes?: number;
    }
  | undefined;

export const APP_VERSION = Constants.expoConfig?.version ?? "0.1.0";
export const API_BASE_URL = normalizeApiUrl(extra?.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api");
export const PLAYLIST_REFRESH_MS = minutesToMs(extra?.playlistRefreshMinutes ?? 5);
export const HEARTBEAT_MS = minutesToMs(extra?.heartbeatMinutes ?? 2);
export const IMAGE_FALLBACK_DURATION_SECONDS = 10;
export const NETWORK_RETRY_ATTEMPTS = 3;

function minutesToMs(minutes: number) {
  return Math.max(1, minutes) * 60 * 1000;
}

function normalizeApiUrl(value: string) {
  return value.replace(/\/+$/, "");
}
