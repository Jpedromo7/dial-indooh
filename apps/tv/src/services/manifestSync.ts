import * as FileSystem from "expo-file-system/legacy";
import { fetchDeviceManifest } from "./apiClient";
import { getCachedManifestV2, saveCachedManifestV2 } from "../storage/deviceStorage";
import type { DeviceSession, TvItem, TvManifest } from "../types/signage";

const CACHE_DIR = `${FileSystem.documentDirectory ?? ""}media-cache/`;
const FILE_TYPES = new Set(["image", "video"]);

export interface CacheStats {
  cachedItems: number;
  totalItems: number;
}

let lastStats: CacheStats = { cachedItems: 0, totalItems: 0 };

export function getCacheStats() {
  return lastStats;
}

/** Baixa o manifesto, guarda os arquivos no aparelho e salva tudo para uso offline. */
export async function syncManifest(session: DeviceSession): Promise<TvManifest & { items: TvItem[] }> {
  const manifest = await fetchDeviceManifest(session.screenId, session.deviceKey);
  const items = await cacheFiles(manifest.items);
  const cachedManifest = { ...manifest, items };

  await saveCachedManifestV2({ manifest: cachedManifest, cachedAt: new Date().toISOString() });
  return cachedManifest;
}

export async function loadOfflineManifest() {
  const cached = await getCachedManifestV2();

  if (!cached) {
    return null;
  }

  // Garante que os arquivos ainda existem (cache pode ter sido limpo).
  const items: TvItem[] = [];
  for (const item of cached.manifest.items) {
    if (!FILE_TYPES.has(item.type)) {
      items.push(item);
      continue;
    }

    if (item.localUri) {
      const info = await FileSystem.getInfoAsync(item.localUri).catch(() => null);
      if (info?.exists) items.push(item);
    }
  }

  return { ...cached.manifest, items };
}

async function cacheFiles(items: TvItem[]) {
  await ensureDirectory();
  const used = new Set<string>();
  const result: TvItem[] = [];
  const fileItems = items.filter((item) => FILE_TYPES.has(item.type) && item.fileUrl);
  let cached = 0;

  for (const item of items) {
    if (!FILE_TYPES.has(item.type) || !item.fileUrl) {
      result.push(item);
      continue;
    }

    try {
      const localUri = await ensureCachedFile(item.mediaId, item.fileUrl, item.mimeType ?? "");
      used.add(localUri);
      result.push({ ...item, localUri });
      cached += 1;
    } catch (error) {
      console.warn(`Mídia ${item.mediaId} não baixada:`, error);
    }
  }

  lastStats = { cachedItems: cached, totalItems: fileItems.length };
  await removeUnused(used);
  return result;
}

async function ensureDirectory() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

async function ensureCachedFile(mediaId: string, url: string, mimeType: string) {
  const localUri = `${CACHE_DIR}${sanitize(mediaId)}-${hash(url)}${extensionFor(url, mimeType)}`;
  const info = await FileSystem.getInfoAsync(localUri);

  if (info.exists && info.size && info.size > 0) {
    return localUri;
  }

  const tempUri = `${localUri}.part`;
  await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
  const download = await FileSystem.downloadAsync(url, tempUri);

  if (download.status < 200 || download.status >= 300) {
    await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
    throw new Error(`HTTP ${download.status}`);
  }

  await FileSystem.moveAsync({ from: tempUri, to: localUri });
  return localUri;
}

async function removeUnused(used: Set<string>) {
  const files = await FileSystem.readDirectoryAsync(CACHE_DIR).catch(() => [] as string[]);
  await Promise.all(
    files
      .map((file) => `${CACHE_DIR}${file}`)
      .filter((uri) => !used.has(uri))
      .map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined))
  );
}

export async function clearAllMedia() {
  await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true }).catch(() => undefined);
  await ensureDirectory();
}

export async function deleteCachedFile(localUri: string | undefined) {
  if (localUri) {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
  }
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0;
  }
  return (result >>> 0).toString(36);
}

function sanitize(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function extensionFor(url: string, mimeType: string) {
  const match = (url.split("?")[0] ?? url).match(/\.[a-zA-Z0-9]{2,5}$/);
  if (match?.[0]) return match[0].toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov"
  };
  return map[mimeType] ?? ".media";
}
