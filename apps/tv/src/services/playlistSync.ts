import { fetchDevicePlaylist } from "./apiClient";
import { ensureMediaCache } from "./mediaCache";
import { getCachedManifest, saveCachedManifest } from "../storage/deviceStorage";
import type { DeviceSession, TvPlaylist } from "../types/signage";

export async function syncPlaylist(session: DeviceSession) {
  const response = await fetchDevicePlaylist(session.screenId, session.deviceKey);
  const cachedPlaylist = await ensureMediaCache(response.playlist);
  const screenOrientation = response.screenOrientation ?? "landscape";

  await saveCachedManifest({
    playlist: cachedPlaylist,
    screenOrientation,
    cachedAt: new Date().toISOString()
  });

  return {
    playlist: cachedPlaylist,
    screenOrientation
  };
}

export async function loadOfflinePlayback() {
  const manifest = await getCachedManifest();
  return {
    playlist: manifest?.playlist ?? null,
    screenOrientation: manifest?.screenOrientation ?? "landscape"
  };
}

export function hasPlayableItems(playlist: TvPlaylist | null) {
  return Boolean(playlist?.items.length);
}
