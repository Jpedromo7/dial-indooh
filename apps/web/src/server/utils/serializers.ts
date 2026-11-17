import type {
  Account,
  Company,
  Media,
  Playlist,
  PlaylistItem,
  Screen,
  ScreenCommand,
  ScreenEvent,
  ScreenHeartbeat,
  ScreenMirrorCandidate,
  ScreenMirrorSession,
  User
} from "@prisma/client";
import type { InstagramConfig, MediaConfig } from "@dialindooh/shared";

type PlaylistItemWithMedia = PlaylistItem & { media: Media };
type PlaylistWithItems = Playlist & { items: PlaylistItemWithMedia[]; _count?: { screenItems?: number } };
type MediaWithExtras = Media & { company?: Company | null; _count?: { screenItems?: number } };

export const ONLINE_HEARTBEAT_WINDOW_MS = 3 * 60 * 1000;
export const DEFAULT_IMAGE_SECONDS = 10;
export const DEFAULT_VIDEO_SECONDS = 30;
export const DEFAULT_WIDGET_SECONDS = 15;

export function serializeMedia(media: MediaWithExtras) {
  return {
    id: media.id,
    accountId: media.accountId,
    companyId: media.companyId,
    companyName: media.company?.name ?? null,
    title: media.title,
    type: media.type,
    category: media.category,
    fileUrl: media.fileUrl,
    fileUrlVertical: media.fileUrlVertical,
    thumbnailUrl: media.thumbnailUrl,
    mimeType: media.mimeType,
    sizeBytes: Number(media.sizeBytes),
    durationSeconds: media.durationSeconds,
    status: media.status,
    orientation: media.orientation,
    rotationDegrees: normalizeMediaRotation(media.rotationDegrees),
    processingError: media.processingError,
    readyAt: media.readyAt,
    config: publicMediaConfig(media),
    recordStats: media.recordStats,
    isLibrary: media.isLibrary,
    schedule: {
      startsAt: media.scheduleStartsAt?.toISOString() ?? null,
      endsAt: media.scheduleEndsAt?.toISOString() ?? null,
      timeFrom: media.scheduleTimeFrom,
      timeTo: media.scheduleTimeTo,
      weekdays: media.scheduleWeekdays
    },
    screenCount: media._count?.screenItems,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt
  };
}

/** Remove segredos (token do Instagram) da configuração antes de enviar ao navegador/TV. */
export function publicMediaConfig(media: Pick<Media, "type" | "config">): MediaConfig | null {
  const config = (media.config ?? null) as Record<string, unknown> | null;

  if (!config) {
    return null;
  }

  if (media.type === "instagram") {
    const { accessToken, ...rest } = config;
    return { ...(rest as unknown as InstagramConfig), connected: Boolean(accessToken) };
  }

  return config as MediaConfig;
}

export function getMediaDurationSeconds(media: Pick<Media, "type" | "durationSeconds">, override?: number | null) {
  if (override && override > 0) {
    return override;
  }

  if (media.durationSeconds && media.durationSeconds > 0) {
    return media.durationSeconds;
  }

  if (media.type === "video") return DEFAULT_VIDEO_SECONDS;
  if (media.type === "image") return DEFAULT_IMAGE_SECONDS;
  return DEFAULT_WIDGET_SECONDS;
}

export function serializePlaylistItem(item: PlaylistItemWithMedia) {
  return {
    id: item.id,
    mediaId: item.mediaId,
    order: item.order,
    displayDurationSeconds: item.displayDurationSeconds,
    media: serializeMedia(item.media)
  };
}

export function serializePlaylist(playlist: PlaylistWithItems) {
  return {
    id: playlist.id,
    accountId: playlist.accountId,
    name: playlist.name,
    description: playlist.description,
    imageUrl: playlist.imageUrl,
    category: playlist.category,
    isLibrary: playlist.isLibrary,
    isActive: playlist.isActive,
    scheduledStartAt: playlist.scheduledStartAt,
    scheduledEndAt: playlist.scheduledEndAt,
    items: playlist.items.map(serializePlaylistItem),
    screenCount: playlist._count?.screenItems,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt
  };
}

export function playlistTotalSeconds(playlist: PlaylistWithItems) {
  return playlist.items.reduce(
    (total, item) => total + getMediaDurationSeconds(item.media, item.displayDurationSeconds),
    0
  );
}

type ScreenItemWithRelations = {
  id: string;
  order: number;
  durationSeconds: number | null;
  mediaId: string | null;
  playlistId: string | null;
  media: MediaWithExtras | null;
  playlist: PlaylistWithItems | null;
};

export function serializeScreenItem(item: ScreenItemWithRelations) {
  return {
    id: item.id,
    order: item.order,
    durationSeconds: item.durationSeconds,
    mediaId: item.mediaId,
    playlistId: item.playlistId,
    media: item.media ? serializeMedia(item.media) : null,
    playlist: item.playlist
      ? {
          id: item.playlist.id,
          name: item.playlist.name,
          imageUrl: item.playlist.imageUrl,
          isLibrary: item.playlist.isLibrary,
          itemCount: item.playlist.items.length,
          totalSeconds: playlistTotalSeconds(item.playlist)
        }
      : null
  };
}

export function screenItemSeconds(item: ScreenItemWithRelations) {
  if (item.playlist) {
    return playlistTotalSeconds(item.playlist);
  }

  return item.media ? getMediaDurationSeconds(item.media, item.durationSeconds) : 0;
}

type ScreenWithRelations = Screen & {
  company?: Company | null;
  items?: ScreenItemWithRelations[];
};

export function serializeScreen(screen: ScreenWithRelations) {
  const lastHeartbeatAt = screen.lastSeenAt;
  const items = screen.items ?? [];

  return {
    id: screen.id,
    accountId: screen.accountId,
    companyId: screen.companyId,
    companyName: screen.company?.name ?? null,
    name: screen.name,
    slug: screen.slug,
    location: screen.location,
    imageUrl: screen.imageUrl,
    segment: screen.segment,
    street: screen.street,
    streetNumber: screen.streetNumber,
    complement: screen.complement,
    zipCode: screen.zipCode,
    district: screen.district,
    state: screen.state,
    city: screen.city,
    phone1: screen.phone1,
    phone2: screen.phone2,
    openFrom: screen.openFrom,
    openTo: screen.openTo,
    openDays: screen.openDays,
    footfall: screen.footfall,
    socialClasses: screen.socialClasses,
    refreshMinutes: screen.refreshMinutes,
    soundEnabled: screen.soundEnabled,
    timezone: screen.timezone,
    footerEnabled: screen.footerEnabled,
    notes: screen.notes,
    isFavorite: screen.isFavorite,
    shuffle: screen.shuffle,
    orientation: screen.orientation,
    activationCode: screen.activationCode,
    deviceKeyRegistered: Boolean(screen.deviceKeyHash || screen.deviceKey),
    status: getEffectiveScreenStatus(lastHeartbeatAt),
    activePlaylistId: items.find((item) => item.playlistId)?.playlistId ?? null,
    itemCount: items.length,
    totalSeconds: items.reduce((total, item) => total + screenItemSeconds(item), 0),
    diagnostics: (screen.diagnostics ?? null) as Record<string, unknown> | null,
    lastSeenAt: screen.lastSeenAt,
    lastHeartbeatAt,
    createdAt: screen.createdAt,
    updatedAt: screen.updatedAt
  };
}

export function serializeHeartbeat(heartbeat: ScreenHeartbeat & { currentMedia?: Media | null }) {
  return {
    ...heartbeat,
    currentMedia: heartbeat.currentMedia ? serializeMedia(heartbeat.currentMedia) : null
  };
}

export function serializeScreenEvent(event: ScreenEvent & { media?: Media | null }) {
  return {
    ...event,
    media: event.media ? serializeMedia(event.media) : null
  };
}

export function serializeScreenCommand(command: ScreenCommand) {
  return command;
}

export function serializeScreenMirrorSession(session: ScreenMirrorSession) {
  return session;
}

export function serializeScreenMirrorCandidate(candidate: ScreenMirrorCandidate) {
  return candidate;
}

export function serializeAccount(account: Account & { _count?: { screens?: number; users?: number } }) {
  return {
    id: account.id,
    name: account.name,
    kind: account.kind,
    parentId: account.parentId,
    isActive: account.isActive,
    logoUrl: account.logoUrl,
    loginImageUrl: account.loginImageUrl,
    splashUrl: account.splashUrl,
    splashEnabled: account.splashEnabled,
    primaryColor: account.primaryColor,
    maxScreens: account.maxScreens,
    maxInstagram: account.maxInstagram,
    apkUrl: account.apkUrl,
    apkVersionCode: account.apkVersionCode,
    screenCount: account._count?.screens,
    userCount: account._count?.users,
    createdAt: account.createdAt
  };
}

export function serializeCompany(company: Company & { _count?: { screens?: number; media?: number } }) {
  return {
    id: company.id,
    accountId: company.accountId,
    name: company.name,
    document: company.document,
    contact: company.contact,
    phone: company.phone,
    screenCount: company._count?.screens ?? 0,
    mediaCount: company._count?.media ?? 0,
    createdAt: company.createdAt
  };
}

export function serializeUser(user: User & { screenAccess?: Array<{ screenId: string }> }) {
  return {
    id: user.id,
    accountId: user.accountId,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    isActive: user.isActive,
    restrictContent: user.restrictContent,
    screenIds: user.screenAccess?.map((access) => access.screenId) ?? [],
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}

export function getEffectiveScreenStatus(lastHeartbeatAt: Date | null | undefined) {
  if (!lastHeartbeatAt) {
    return "offline" as const;
  }

  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime();
  return ageMs <= ONLINE_HEARTBEAT_WINDOW_MS ? ("online" as const) : ("offline" as const);
}

function normalizeMediaRotation(value: number) {
  if (value === 90 || value === 180 || value === 270) {
    return value;
  }

  return 0;
}
