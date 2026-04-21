import * as FileSystem from "expo-file-system/legacy";
import type { TvPlaylist, TvPlaylistItem } from "../types/signage";

const CACHE_DIR = `${FileSystem.documentDirectory ?? ""}media-cache/`;

export async function ensureMediaCache(playlist: TvPlaylist | null) {
  await ensureCacheDirectory();

  if (!playlist) {
    return null;
  }

  const usedPaths = new Set<string>();
  const cachedItems: TvPlaylistItem[] = [];

  for (const item of playlist.items) {
    try {
      const localUri = await ensureCachedMedia(item.media.id, item.media.fileUrl, item.media.mimeType);
      usedPaths.add(localUri);

      cachedItems.push({
        ...item,
        media: {
          ...item.media,
          localUri
        }
      });
    } catch (error) {
      console.warn(`Skipping media ${item.media.id}:`, error);
    }
  }

  await removeUnusedFiles(usedPaths);

  return {
    ...playlist,
    items: cachedItems
  };
}

export async function clearCorruptedMedia(localUri: string | undefined) {
  if (!localUri) {
    return;
  }

  await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
}

async function ensureCacheDirectory() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

async function ensureCachedMedia(mediaId: string, remoteUrl: string, mimeType: string) {
  const extension = getExtension(remoteUrl, mimeType);
  const localUri = `${CACHE_DIR}${sanitizeFileName(mediaId)}${extension}`;
  const info = await FileSystem.getInfoAsync(localUri);

  if (info.exists && info.size && info.size > 0) {
    return localUri;
  }

  await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
  const download = await FileSystem.downloadAsync(remoteUrl, localUri);

  if (download.status < 200 || download.status >= 300) {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    throw new Error(`Failed to download media ${mediaId}`);
  }

  return localUri;
}

async function removeUnusedFiles(usedPaths: Set<string>) {
  const directoryInfo = await FileSystem.getInfoAsync(CACHE_DIR);

  if (!directoryInfo.exists) {
    return;
  }

  const files = await FileSystem.readDirectoryAsync(CACHE_DIR);

  await Promise.all(
    files.map(async (file) => {
      const uri = `${CACHE_DIR}${file}`;

      if (!usedPaths.has(uri)) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      }
    })
  );
}

function getExtension(value: string, mimeType: string) {
  const cleanUrl = value.split("?")[0] ?? value;
  const match = cleanUrl.match(/\.[a-zA-Z0-9]+$/);

  if (match?.[0]) {
    return match[0];
  }

  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "video/mp4") return ".mp4";
  if (mimeType === "video/webm") return ".webm";
  if (mimeType === "video/quicktime") return ".mov";

  return ".media";
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
