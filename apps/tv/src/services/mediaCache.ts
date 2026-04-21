import * as FileSystem from "expo-file-system/legacy";
import type { TvPlaylist } from "../types/signage";

const CACHE_DIR = `${FileSystem.documentDirectory ?? ""}media-cache/`;

export async function ensureMediaCache(playlist: TvPlaylist | null) {
  await ensureCacheDirectory();

  if (!playlist) {
    return null;
  }

  const usedPaths = new Set<string>();
  const cachedItems = await Promise.all(
    playlist.items.map(async (item) => {
      const localUri = await ensureCachedMedia(item.media.id, item.media.fileUrl);
      usedPaths.add(localUri);

      return {
        ...item,
        media: {
          ...item.media,
          localUri
        }
      };
    })
  );

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

async function ensureCachedMedia(mediaId: string, remoteUrl: string) {
  const extension = getExtension(remoteUrl);
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

function getExtension(value: string) {
  const cleanUrl = value.split("?")[0] ?? value;
  const match = cleanUrl.match(/\.[a-zA-Z0-9]+$/);
  return match?.[0] ?? ".media";
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
