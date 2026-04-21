import type { MediaType, ScreenStatus } from "@dialindooh/shared";

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
  items: TvPlaylistItem[];
  updatedAt?: string;
}

export interface CachedManifest {
  playlist: TvPlaylist | null;
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
  sentAt: string;
}
