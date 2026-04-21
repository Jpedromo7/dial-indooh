import { fetchDevicePlaylist } from "./apiClient";
import { ensureMediaCache } from "./mediaCache";
import { getCachedManifest, saveCachedManifest } from "../storage/deviceStorage";
import type { DeviceSession, TvPlaylist } from "../types/signage";

export async function syncPlaylist(session: DeviceSession) {
  const remotePlaylist = await fetchDevicePlaylist(session.screenId, session.deviceKey);
  const cachedPlaylist = await ensureMediaCache(remotePlaylist);
  await saveCachedManifest({
    playlist: cachedPlaylist,
    cachedAt: new Date().toISOString()
  });

  return cachedPlaylist;
}

export async function loadOfflinePlaylist() {
  const manifest = await getCachedManifest();
  return manifest?.playlist ?? null;
}

export function hasPlayableItems(playlist: TvPlaylist | null) {
  return Boolean(playlist?.items.length);
}
