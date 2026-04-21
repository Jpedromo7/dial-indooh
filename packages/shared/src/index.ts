export type MediaType = "image" | "video";

export type ScreenStatus = "online" | "offline";

export type UserRole = "admin";

export interface MediaDto {
  id: string;
  title: string;
  type: MediaType;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
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
  items: PlaylistItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ScreenDto {
  id: string;
  name: string;
  slug: string;
  location: string | null;
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
  sentAt: string;
  currentMedia?: MediaDto | null;
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
