import type { Media, Playlist, PlaylistItem, Screen, ScreenAssignment, ScreenHeartbeat } from "@prisma/client";

type PlaylistItemWithMedia = PlaylistItem & {
  media: Media;
};

type PlaylistWithItems = Playlist & {
  items: PlaylistItemWithMedia[];
};

type ScreenWithRelations = Screen & {
  assignments?: ScreenAssignment[];
  heartbeats?: ScreenHeartbeat[];
};

type ScreenDetail = Screen & {
  assignments: Array<ScreenAssignment & { playlist: PlaylistWithItems }>;
  heartbeats: Array<ScreenHeartbeat & { currentMedia: Media | null }>;
};

export function serializeMedia(media: Media) {
  return {
    ...media,
    sizeBytes: Number(media.sizeBytes)
  };
}

export function serializePlaylistItem(item: PlaylistItemWithMedia) {
  return {
    ...item,
    media: serializeMedia(item.media)
  };
}

export function serializePlaylist(playlist: PlaylistWithItems) {
  return {
    ...playlist,
    items: playlist.items.map(serializePlaylistItem)
  };
}

export function serializeScreen(screen: ScreenWithRelations) {
  const activeAssignment = screen.assignments?.find((assignment) => assignment.isActive);
  const latestHeartbeat = screen.heartbeats?.[0];

  return {
    id: screen.id,
    name: screen.name,
    slug: screen.slug,
    activationCode: screen.activationCode,
    location: screen.location,
    status: screen.status,
    lastSeenAt: screen.lastSeenAt,
    createdAt: screen.createdAt,
    updatedAt: screen.updatedAt,
    deviceKeyRegistered: Boolean(screen.deviceKey),
    activePlaylistId: activeAssignment?.playlistId ?? null,
    lastHeartbeatAt: latestHeartbeat?.sentAt ?? screen.lastSeenAt
  };
}

export function serializeHeartbeat(heartbeat: ScreenHeartbeat & { currentMedia?: Media | null }) {
  return {
    ...heartbeat,
    currentMedia: heartbeat.currentMedia ? serializeMedia(heartbeat.currentMedia) : null
  };
}

export function serializeScreenDetail(screen: ScreenDetail) {
  const activeAssignment = screen.assignments.find((assignment) => assignment.isActive) ?? null;
  const latestHeartbeat = screen.heartbeats[0] ?? null;

  return {
    ...serializeScreen(screen),
    activeAssignment: activeAssignment
      ? {
          ...activeAssignment,
          playlist: serializePlaylist(activeAssignment.playlist)
        }
      : null,
    lastHeartbeat: latestHeartbeat ? serializeHeartbeat(latestHeartbeat) : null
  };
}
