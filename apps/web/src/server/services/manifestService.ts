import crypto from "node:crypto";
import type { Media, Playlist } from "@prisma/client";
import {
  DEFAULT_FOOTER,
  type CurrencyConfig,
  type DeviceManifest,
  type FooterConfig,
  type InstagramConfig,
  type ManifestItem,
  type RssConfig,
  type ScheduleDto,
  type WeatherConfig
} from "@dialindooh/shared";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { getCurrencyQuotes, getInstagramPosts, getRssItems, getWeather } from "@/server/services/externalData";
import { getMediaDurationSeconds, publicMediaConfig } from "@/server/utils/serializers";

const FILE_TYPES = new Set(["image", "video"]);

/** Monta o manifesto v2: lista final da tela, já com grupos expandidos, arquivo certo por orientação e dados dos widgets. */
export async function buildDeviceManifest(screenId: string): Promise<DeviceManifest> {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    include: {
      account: { include: { parent: true } },
      items: {
        orderBy: { order: "asc" },
        include: {
          media: true,
          playlist: { include: { items: { orderBy: { order: "asc" }, include: { media: true } } } }
        }
      }
    }
  });

  if (!screen) {
    throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
  }

  const entries: Array<{ key: string; media: Media; playlist: Playlist | null; durationOverride: number | null }> = [];

  for (const item of screen.items) {
    if (item.media) {
      entries.push({ key: item.id, media: item.media, playlist: null, durationOverride: item.durationSeconds });
    } else if (item.playlist && item.playlist.isActive) {
      for (const groupItem of item.playlist.items) {
        entries.push({
          key: `${item.id}:${groupItem.id}`,
          media: groupItem.media,
          playlist: item.playlist,
          durationOverride: groupItem.displayDurationSeconds
        });
      }
    }
  }

  const items: ManifestItem[] = [];

  for (const entry of entries) {
    const manifestItem = await toManifestItem(entry, screen);

    if (manifestItem) {
      items.push(manifestItem);
    }
  }

  const account = screen.account;
  const footerSource = (account?.footer ?? account?.parent?.footer ?? null) as Partial<FooterConfig> | null;
  let footer: DeviceManifest["footer"] = null;

  if (screen.footerEnabled) {
    const config = { ...DEFAULT_FOOTER, ...(footerSource ?? {}) };
    const [weather, headlines] = await Promise.all([
      config.showWeather ? getWeather(screen.city, screen.state) : Promise.resolve(null),
      config.rssUrl ? getRssItems(config.rssUrl, 10) : Promise.resolve([])
    ]);
    footer = { ...config, weather, headlines: headlines.map((headline) => headline.title) };
  }

  const splashEnabled = account?.splashEnabled ?? account?.parent?.splashEnabled ?? false;

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    screen: {
      id: screen.id,
      name: screen.name,
      orientation: screen.orientation,
      soundEnabled: screen.soundEnabled,
      timezone: screen.timezone,
      refreshMinutes: screen.refreshMinutes,
      footerEnabled: screen.footerEnabled,
      shuffle: screen.shuffle
    },
    branding: {
      logoUrl: account?.logoUrl ?? account?.parent?.logoUrl ?? null,
      splashUrl: splashEnabled ? account?.splashUrl ?? account?.parent?.splashUrl ?? null : null
    },
    footer,
    items
  };
}

async function toManifestItem(
  entry: { key: string; media: Media; playlist: Playlist | null; durationOverride: number | null },
  screen: { orientation: string; city: string | null; state: string | null }
): Promise<ManifestItem | null> {
  const { media, playlist } = entry;

  if (media.status !== "ready") {
    return null;
  }

  let fileUrl: string | null = null;

  if (FILE_TYPES.has(media.type)) {
    fileUrl =
      screen.orientation === "portrait"
        ? media.fileUrlVertical || media.fileUrl || null
        : media.fileUrl || media.fileUrlVertical || null;

    if (!fileUrl) {
      return null;
    }
  }

  const config = publicMediaConfig(media);
  const rawConfig = (media.config ?? {}) as Record<string, unknown>;
  let data: ManifestItem["data"] = null;

  switch (media.type) {
    case "currency":
      data = { quotes: await getCurrencyQuotes((config as CurrencyConfig | null)?.currencies ?? ["USD"]) };
      break;
    case "weather": {
      const weatherConfig = config as WeatherConfig | null;
      data = { weather: await getWeather(weatherConfig?.city || screen.city, weatherConfig?.city ? weatherConfig?.state : screen.state) };
      break;
    }
    case "rss": {
      const rssConfig = config as RssConfig | null;
      data = { rss: rssConfig?.url ? await getRssItems(rssConfig.url, rssConfig.maxItems ?? 5) : [] };
      break;
    }
    case "instagram": {
      const token = rawConfig.accessToken as string | undefined;
      const count = (config as InstagramConfig | null)?.postsCount ?? 1;
      data = { posts: token ? await getInstagramPosts(media.id, token, count) : [] };
      break;
    }
    default:
      break;
  }

  if (media.type === "rss" && !data?.rss?.length) return null;
  if (media.type === "instagram" && !data?.posts?.length) return null;

  return {
    key: entry.key,
    mediaId: media.id,
    playlistId: playlist?.id ?? null,
    type: media.type,
    title: media.title,
    durationSeconds: getMediaDurationSeconds(media, entry.durationOverride),
    fileUrl,
    mimeType: media.mimeType || null,
    rotationDegrees: normalizeRotation(media.rotationDegrees),
    schedule: mergeSchedules(media, playlist),
    recordStats: media.recordStats,
    config,
    data
  };
}

function mergeSchedules(media: Media, playlist: Playlist | null): ScheduleDto {
  const starts = [media.scheduleStartsAt, playlist?.scheduledStartAt].filter((value): value is Date => Boolean(value));
  const ends = [media.scheduleEndsAt, playlist?.scheduledEndAt].filter((value): value is Date => Boolean(value));

  return {
    startsAt: starts.length ? new Date(Math.max(...starts.map((date) => date.getTime()))).toISOString() : null,
    endsAt: ends.length ? new Date(Math.min(...ends.map((date) => date.getTime()))).toISOString() : null,
    timeFrom: media.scheduleTimeFrom,
    timeTo: media.scheduleTimeTo,
    weekdays: media.scheduleWeekdays
  };
}

/**
 * Formato antigo (APK até 0.1.x): só imagens e vídeos, como uma "playlist".
 * Mantém as TVs já instaladas funcionando até receberem o APK novo.
 */
export function toLegacyPlaylist(manifest: DeviceManifest) {
  const today = new Date().toISOString().slice(0, 10);
  const items = manifest.items
    .filter((item) => FILE_TYPES.has(item.type) && item.fileUrl)
    .filter((item) => (!item.schedule.startsAt || item.schedule.startsAt.slice(0, 10) <= today) && (!item.schedule.endsAt || item.schedule.endsAt.slice(0, 10) >= today))
    .map((item, index) => ({
      id: item.key,
      mediaId: item.mediaId,
      order: index + 1,
      displayDurationSeconds: item.type === "image" ? item.durationSeconds : null,
      media: {
        id: item.mediaId,
        title: item.title,
        type: item.type,
        fileUrl: item.fileUrl,
        mimeType: item.mimeType ?? "",
        sizeBytes: 0,
        durationSeconds: item.type === "video" ? item.durationSeconds : null,
        status: "ready",
        orientation: "auto",
        rotationDegrees: item.rotationDegrees,
        processingError: null,
        readyAt: null
      }
    }));

  const fingerprint = crypto.createHash("sha1").update(JSON.stringify(items.map((item) => [item.id, item.media.fileUrl, item.displayDurationSeconds]))).digest("hex");

  return {
    screenOrientation: manifest.screen.orientation,
    playlist: items.length
      ? {
          id: `screen-${manifest.screen.id}`,
          name: manifest.screen.name,
          description: null,
          isActive: true,
          scheduledStartAt: null,
          scheduledEndAt: null,
          items,
          updatedAt: fingerprint
        }
      : null
  };
}

function normalizeRotation(value: number) {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}
