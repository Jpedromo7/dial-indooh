import type {
  Media,
  Playlist,
  PlaylistItem,
  Screen,
  ScreenAssignment,
  ScreenCommand,
  ScreenEvent,
  ScreenHeartbeat
} from "@prisma/client";

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
  events: Array<ScreenEvent & { media: Media | null }>;
  commands: ScreenCommand[];
};

const ONLINE_HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;

export function serializeMedia(media: Media) {
  return {
    ...media,
    sizeBytes: Number(media.sizeBytes),
    rotationDegrees: normalizeMediaRotation(media.rotationDegrees)
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
  const lastHeartbeatAt = latestHeartbeat?.sentAt ?? screen.lastSeenAt;

  return {
    id: screen.id,
    name: screen.name,
    slug: screen.slug,
    activationCode: screen.activationCode,
    location: screen.location,
    orientation: screen.orientation,
    status: getEffectiveScreenStatus(screen.status, lastHeartbeatAt),
    lastSeenAt: screen.lastSeenAt,
    createdAt: screen.createdAt,
    updatedAt: screen.updatedAt,
    deviceKeyRegistered: Boolean(screen.deviceKey),
    activePlaylistId: activeAssignment?.playlistId ?? null,
    lastHeartbeatAt
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
    lastHeartbeat: latestHeartbeat ? serializeHeartbeat(latestHeartbeat) : null,
    recentEvents: screen.events.map(serializeScreenEvent),
    recentCommands: screen.commands.map(serializeScreenCommand)
  };
}

function getEffectiveScreenStatus(status: Screen["status"], lastHeartbeatAt: Date | null | undefined) {
  if (status === "offline" || !lastHeartbeatAt) {
    return "offline";
  }

  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime();
  return ageMs <= ONLINE_HEARTBEAT_WINDOW_MS ? "online" : "offline";
}

function normalizeMediaRotation(value: number) {
  if (value === 90 || value === 180 || value === 270) {
    return value;
  }

  return 0;
}
