import type {
  MediaOrientation,
  MediaRotation,
  MediaStatus,
  MediaType,
  PlaybackState,
  RemoteControlKey,
  ScreenCommandStatus,
  ScreenCommandType,
  ScreenEventLevel,
  ScreenMirrorCandidateDto,
  ScreenMirrorSessionDto,
  ScreenOrientation,
  ScreenStatus
} from "@dialindooh/shared";

export interface DeviceSession {
  screenId: string;
  deviceKey: string;
  activatedAt: string;
}

export interface TvMedia {
  id: string;
  title: string;
  type: MediaType;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  status: MediaStatus;
  orientation: MediaOrientation;
  rotationDegrees: MediaRotation;
  processingError: string | null;
  readyAt: string | null;
  localUri?: string;
}

export interface TvPlaylistItem {
  id: string;
  mediaId: string;
  order: number;
  displayDurationSeconds: number | null;
  media: TvMedia;
}

export interface TvPlaylist {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  items: TvPlaylistItem[];
  updatedAt?: string;
}

export interface DevicePlaylistResponse {
  playlist: TvPlaylist | null;
  screenOrientation?: ScreenOrientation;
}

export interface ScreenCommand {
  id: string;
  screenId: string;
  type: ScreenCommandType;
  payload: Record<string, unknown> | null;
  status: ScreenCommandStatus;
  requestedAt: string;
}

export interface PlaybackStatus {
  currentItem: TvPlaylistItem | null;
  positionSeconds: number | null;
  durationSeconds: number | null;
  state: PlaybackState;
}

export interface RemoteKeyCommand {
  id: string;
  key: RemoteControlKey;
}

export type ScreenMirrorSession = ScreenMirrorSessionDto;

export type ScreenMirrorCandidate = ScreenMirrorCandidateDto;

export interface ScreenEventInput {
  level: ScreenEventLevel;
  type: string;
  message: string;
  mediaId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CachedManifest {
  playlist: TvPlaylist | null;
  screenOrientation: ScreenOrientation;
  cachedAt: string;
}

export interface ActivationResponse {
  screenId: string;
  deviceKey: string;
}

export interface HeartbeatInput {
  status: ScreenStatus;
  appVersion: string;
  ipAddress?: string;
  currentMediaId?: string;
  currentPlaylistItemId?: string | null;
  playbackPositionSeconds?: number | null;
  playbackDurationSeconds?: number | null;
  playbackState?: PlaybackState;
  sentAt: string;
}
