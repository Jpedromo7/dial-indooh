export type MediaType = "image" | "video";

export type MediaStatus = "pending" | "processing" | "ready" | "failed";

export type MediaOrientation = "auto" | "landscape" | "portrait" | "square";

export type MediaRotation = 0 | 90 | 180 | 270;

export type ScreenStatus = "online" | "offline";

export type ScreenOrientation = "landscape" | "portrait";

export type ScreenEventLevel = "info" | "warn" | "error";

export type PlaybackState = "idle" | "playing" | "paused" | "transitioning" | "error";

export type RemoteControlKey = "up" | "down" | "left" | "right" | "select" | "back";

export type ScreenCommandType =
  | "refresh_playlist"
  | "clear_cache"
  | "restart_player"
  | "reload_app"
  | "open_overlay_settings"
  | "remote_key";

export type ScreenCommandStatus = "pending" | "delivered" | "acknowledged" | "failed";

export type UserRole = "admin";

export interface MediaDto {
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
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItemDto {
  id: string;
  mediaId: string;
  order: number;
  displayDurationSeconds: number | null;
  media: MediaDto;
}

export interface PlaylistDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  items: PlaylistItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ScreenDto {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  orientation: ScreenOrientation;
  activationCode: string;
  deviceKeyRegistered: boolean;
  status: ScreenStatus;
  activePlaylistId: string | null;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenHeartbeatDto {
  id?: string;
  screenId: string;
  status: ScreenStatus;
  appVersion: string | null;
  ipAddress: string | null;
  currentMediaId: string | null;
  currentPlaylistItemId: string | null;
  playbackPositionSeconds: number | null;
  playbackDurationSeconds: number | null;
  playbackState: PlaybackState | null;
  sentAt: string;
  currentMedia?: MediaDto | null;
}

export interface ScreenEventDto {
  id: string;
  screenId: string;
  level: ScreenEventLevel;
  type: string;
  message: string;
  mediaId: string | null;
  media?: MediaDto | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ScreenCommandDto {
  id: string;
  screenId: string;
  type: ScreenCommandType;
  payload: Record<string, unknown> | null;
  status: ScreenCommandStatus;
  requestedById: string | null;
  requestedAt: string;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  errorMessage: string | null;
}

export interface ScreenAssignmentDto {
  id: string;
  screenId: string;
  playlistId: string;
  isActive: boolean;
  assignedAt: string;
  playlist: PlaylistDto;
}

export interface ScreenDetailDto extends ScreenDto {
  activeAssignment: ScreenAssignmentDto | null;
  lastHeartbeat: ScreenHeartbeatDto | null;
  recentEvents: ScreenEventDto[];
  recentCommands: ScreenCommandDto[];
}

export interface ActivationRequest {
  activationCode: string;
  deviceName?: string;
  appVersion?: string;
}

export interface ActivationResponse {
  screenId: string;
  deviceKey: string;
  playlist: PlaylistDto | null;
}

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
