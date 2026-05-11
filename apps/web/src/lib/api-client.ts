"use client";

import type {
  MediaDto,
  MediaOrientation,
  MediaRotation,
  PlaylistDto,
  ScreenCommandDto,
  ScreenCommandType,
  ScreenDetailDto,
  ScreenDto,
  ScreenEventDto,
  ScreenOrientation
} from "@dialindooh/shared";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const DEMO_STORE_KEY = "dial_indooh_demo_store";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    method: options.method ?? "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: { code?: string; message: string; details?: unknown } }
    | null;

  if (!response.ok || !payload?.ok) {
    const error = payload && !payload.ok ? payload.error : null;
    throw new ApiClientError(error?.message ?? "A requisição falhou.", response.status, error?.code, error?.details);
  }

  return payload.data;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin";
  };
}

export interface MediaCreateInput {
  title: string;
  type: "image" | "video";
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number | null;
  orientation?: MediaOrientation;
  rotationDegrees?: MediaRotation;
}

export interface MediaUploadUrlInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MediaUploadUrlResponse {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

export interface PlaylistCreateInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
}

export interface ScreenCreateInput {
  name: string;
  slug?: string;
  location?: string | null;
  orientation?: ScreenOrientation;
}

export const apiClient = {
  login: (email: string, password: string) => {
    if (DEMO_MODE) {
      return demoLogin(email, password);
    }

    return request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password }
    });
  },

  listMedia: () => (DEMO_MODE ? demoApi.listMedia() : request<MediaDto[]>("/api/media")),
  createMediaUploadUrl: (input: MediaUploadUrlInput) =>
    DEMO_MODE
      ? demoApi.createMediaUploadUrl(input)
      : request<MediaUploadUrlResponse>("/api/media/upload-url", { method: "POST", body: input }),
  createMedia: (input: MediaCreateInput) =>
    DEMO_MODE ? demoApi.createMedia(input) : request<MediaDto>("/api/media", { method: "POST", body: input }),
  updateMedia: (id: string, input: { title?: string; orientation?: MediaOrientation; rotationDegrees?: MediaRotation }) =>
    DEMO_MODE ? demoApi.updateMedia(id, input) : request<MediaDto>(`/api/media/${id}`, { method: "PATCH", body: input }),
  deleteMedia: (id: string) =>
    DEMO_MODE ? demoApi.deleteMedia(id) : request<{ id: string }>(`/api/media/${id}`, { method: "DELETE" }),

  listPlaylists: () => (DEMO_MODE ? demoApi.listPlaylists() : request<PlaylistDto[]>("/api/playlists")),
  createPlaylist: (input: PlaylistCreateInput) =>
    DEMO_MODE ? demoApi.createPlaylist(input) : request<PlaylistDto>("/api/playlists", { method: "POST", body: input }),
  getPlaylist: (id: string) => (DEMO_MODE ? demoApi.getPlaylist(id) : request<PlaylistDto>(`/api/playlists/${id}`)),
  updatePlaylist: (id: string, input: Partial<PlaylistCreateInput>) =>
    DEMO_MODE
      ? demoApi.updatePlaylist(id, input)
      : request<PlaylistDto>(`/api/playlists/${id}`, { method: "PATCH", body: input }),
  deletePlaylist: (id: string) =>
    DEMO_MODE ? demoApi.deletePlaylist(id) : request<{ id: string }>(`/api/playlists/${id}`, { method: "DELETE" }),
  addPlaylistItem: (
    playlistId: string,
    input: { mediaId: string; order?: number; displayDurationSeconds?: number | null }
  ) =>
    DEMO_MODE
      ? demoApi.addPlaylistItem(playlistId, input)
      : request<PlaylistDto>(`/api/playlists/${playlistId}/items`, { method: "POST", body: input }),
  updatePlaylistItem: (playlistId: string, itemId: string, input: { displayDurationSeconds: number | null }) =>
    DEMO_MODE
      ? demoApi.updatePlaylistItem(playlistId, itemId, input)
      : request<PlaylistDto>(`/api/playlists/${playlistId}/items/${itemId}`, { method: "PATCH", body: input }),
  reorderPlaylistItems: (playlistId: string, items: Array<{ id: string; order: number }>) =>
    DEMO_MODE
      ? demoApi.reorderPlaylistItems(playlistId, items)
      : request<PlaylistDto>(`/api/playlists/${playlistId}/items/reorder`, { method: "PATCH", body: { items } }),
  deletePlaylistItem: (playlistId: string, itemId: string) =>
    DEMO_MODE
      ? demoApi.deletePlaylistItem(playlistId, itemId)
      : request<PlaylistDto>(`/api/playlists/${playlistId}/items/${itemId}`, { method: "DELETE" }),

  listScreens: () => (DEMO_MODE ? demoApi.listScreens() : request<ScreenDto[]>("/api/screens")),
  createScreen: (input: ScreenCreateInput) =>
    DEMO_MODE ? demoApi.createScreen(input) : request<ScreenDto>("/api/screens", { method: "POST", body: input }),
  getScreen: (id: string) => (DEMO_MODE ? demoApi.getScreen(id) : request<ScreenDetailDto>(`/api/screens/${id}`)),
  updateScreen: (id: string, input: Partial<ScreenCreateInput> & { playlistId?: string | null; status?: string }) =>
    DEMO_MODE
      ? demoApi.updateScreen(id, input)
      : request<ScreenDto>(`/api/screens/${id}`, { method: "PATCH", body: input }),
  deleteScreen: (id: string) =>
    DEMO_MODE ? demoApi.deleteScreen(id) : request<{ id: string }>(`/api/screens/${id}`, { method: "DELETE" }),
  listScreenEvents: (id: string) =>
    DEMO_MODE ? Promise.resolve([]) : request<ScreenEventDto[]>(`/api/screens/${id}/events`),
  createScreenCommand: (id: string, type: ScreenCommandType) =>
    DEMO_MODE
      ? Promise.resolve({
          id: createId("command"),
          screenId: id,
          type,
          payload: null,
          status: "pending",
          requestedById: "demo-admin",
          requestedAt: new Date().toISOString(),
          deliveredAt: null,
          acknowledgedAt: null,
          errorMessage: null
        } satisfies ScreenCommandDto)
      : request<ScreenCommandDto>(`/api/screens/${id}/commands`, { method: "POST", body: { type } })
};

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Algo deu errado.";
}

interface DemoStore {
  media: MediaDto[];
  playlists: PlaylistDto[];
  screens: ScreenDto[];
}

function demoLogin(email: string, password: string): Promise<LoginResponse> {
  if (email !== "admin@dialindooh.local" || password !== "Admin123!") {
    return Promise.reject(new ApiClientError("Email ou senha inválidos.", 401, "invalid_credentials"));
  }

  return Promise.resolve({
    token: "demo-token",
    user: {
      id: "demo-admin",
      name: "Administrador de demonstração",
      email,
      role: "admin"
    }
  });
}

const demoApi = {
  listMedia: async () => getDemoStore().media,
  createMediaUploadUrl: async (input: MediaUploadUrlInput) => ({
    bucket: "demo",
    path: `uploads/${encodeURIComponent(input.fileName)}`,
    token: "demo-token",
    signedUrl: "",
    publicUrl: URL.createObjectURL(new File([], input.fileName, { type: input.mimeType }))
  }),
  createMedia: async (input: MediaCreateInput) => {
    const store = getDemoStore();
    const now = new Date().toISOString();
    const media: MediaDto = {
      id: createId("media"),
      title: input.title,
      type: input.type,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      durationSeconds: input.durationSeconds ?? null,
      status: "ready",
      orientation: input.orientation ?? "auto",
      rotationDegrees: input.rotationDegrees ?? 0,
      processingError: null,
      readyAt: now,
      createdAt: now,
      updatedAt: now
    };
    store.media.unshift(media);
    saveDemoStore(store);
    return media;
  },
  deleteMedia: async (id: string) => {
    const store = getDemoStore();
    store.media = store.media.filter((item) => item.id !== id);
    store.playlists = store.playlists.map((playlist) => ({
      ...playlist,
      items: playlist.items.filter((item) => item.mediaId !== id)
    }));
    saveDemoStore(store);
    return { id };
  },
  updateMedia: async (id: string, input: { title?: string; orientation?: MediaOrientation; rotationDegrees?: MediaRotation }) => {
    const store = getDemoStore();
    const media = store.media.find((item) => item.id === id);
    if (!media) throw new ApiClientError("Mídia não encontrada.", 404);
    const updated = {
      ...media,
      title: input.title ?? media.title,
      orientation: input.orientation ?? media.orientation,
      rotationDegrees: input.rotationDegrees ?? media.rotationDegrees,
      updatedAt: new Date().toISOString()
    };
    store.media = store.media.map((item) => (item.id === id ? updated : item));
    store.playlists = store.playlists.map((playlist) => ({
      ...playlist,
      items: playlist.items.map((item) => (item.mediaId === id ? { ...item, media: updated } : item))
    }));
    saveDemoStore(store);
    return updated;
  },
  listPlaylists: async () => getDemoStore().playlists,
  createPlaylist: async (input: PlaylistCreateInput) => {
    const store = getDemoStore();
    const now = new Date().toISOString();
    const playlist: PlaylistDto = {
      id: createId("playlist"),
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      scheduledStartAt: input.scheduledStartAt ?? null,
      scheduledEndAt: input.scheduledEndAt ?? null,
      items: [],
      createdAt: now,
      updatedAt: now
    };
    store.playlists.unshift(playlist);
    saveDemoStore(store);
    return playlist;
  },
  getPlaylist: async (id: string) => findPlaylist(id),
  updatePlaylist: async (id: string, input: Partial<PlaylistCreateInput>) => {
    const store = getDemoStore();
    let updated = findPlaylist(id, store);
    updated = {
      ...updated,
      ...input,
      description: input.description === undefined ? updated.description : input.description ?? null,
      updatedAt: new Date().toISOString()
    };
    store.playlists = store.playlists.map((playlist) => (playlist.id === id ? updated : playlist));
    saveDemoStore(store);
    return updated;
  },
  addPlaylistItem: async (
    playlistId: string,
    input: { mediaId: string; order?: number; displayDurationSeconds?: number | null }
  ) => {
    const store = getDemoStore();
    const media = store.media.find((item) => item.id === input.mediaId);
    if (!media) throw new ApiClientError("Mídia não encontrada.", 404);
    const playlist = findPlaylist(playlistId, store);
    const item = {
      id: createId("item"),
      mediaId: media.id,
      order: playlist.items.length + 1,
      displayDurationSeconds: media.type === "image" ? input.displayDurationSeconds ?? 10 : null,
      media
    };
    return replacePlaylist(store, { ...playlist, items: [...playlist.items, item], updatedAt: new Date().toISOString() });
  },
  updatePlaylistItem: async (playlistId: string, itemId: string, input: { displayDurationSeconds: number | null }) => {
    const store = getDemoStore();
    const playlist = findPlaylist(playlistId, store);
    return replacePlaylist(store, {
      ...playlist,
      items: playlist.items.map((item) =>
        item.id === itemId ? { ...item, displayDurationSeconds: input.displayDurationSeconds } : item
      ),
      updatedAt: new Date().toISOString()
    });
  },
  reorderPlaylistItems: async (playlistId: string, items: Array<{ id: string; order: number }>) => {
    const store = getDemoStore();
    const playlist = findPlaylist(playlistId, store);
    const orderById = new Map(items.map((item) => [item.id, item.order]));
    return replacePlaylist(store, {
      ...playlist,
      items: playlist.items
        .map((item) => ({ ...item, order: orderById.get(item.id) ?? item.order }))
        .sort((left, right) => left.order - right.order),
      updatedAt: new Date().toISOString()
    });
  },
  deletePlaylistItem: async (playlistId: string, itemId: string) => {
    const store = getDemoStore();
    const playlist = findPlaylist(playlistId, store);
    return replacePlaylist(store, {
      ...playlist,
      items: playlist.items
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({ ...item, order: index + 1 })),
      updatedAt: new Date().toISOString()
    });
  },
  deletePlaylist: async (id: string) => {
    const store = getDemoStore();
    findPlaylist(id, store);
    store.playlists = store.playlists.filter((playlist) => playlist.id !== id);
    store.screens = store.screens.map((screen) => ({
      ...screen,
      activePlaylistId: screen.activePlaylistId === id ? null : screen.activePlaylistId
    }));
    saveDemoStore(store);
    return { id };
  },
  listScreens: async () => getDemoStore().screens,
  createScreen: async (input: ScreenCreateInput) => {
    const store = getDemoStore();
    const now = new Date().toISOString();
    const screen: ScreenDto = {
      id: createId("screen"),
      name: input.name,
      slug: input.slug || slugify(input.name),
      location: input.location ?? null,
      orientation: input.orientation ?? "landscape",
      activationCode: createActivationCode(),
      deviceKeyRegistered: false,
      status: "offline",
      activePlaylistId: null,
      lastSeenAt: null,
      lastHeartbeatAt: null,
      createdAt: now,
      updatedAt: now
    };
    store.screens.unshift(screen);
    saveDemoStore(store);
    return screen;
  },
  getScreen: async (id: string) => {
    const store = getDemoStore();
    const screen = findScreen(id, store);
    const playlist = screen.activePlaylistId ? findPlaylist(screen.activePlaylistId, store) : null;
    return {
      ...screen,
      activeAssignment: playlist
        ? {
            id: "demo-assignment",
            screenId: screen.id,
            playlistId: playlist.id,
            isActive: true,
            assignedAt: screen.updatedAt,
            playlist
          }
        : null,
      lastHeartbeat: screen.lastSeenAt
        ? {
            id: "demo-heartbeat",
            screenId: screen.id,
            status: screen.status,
            appVersion: "0.1.0-demo",
            ipAddress: "192.168.0.40",
            currentMediaId: playlist?.items[0]?.mediaId ?? null,
            currentMedia: playlist?.items[0]?.media ?? null,
            sentAt: screen.lastSeenAt
          }
        : null,
      recentEvents: [],
      recentCommands: []
    };
  },
  updateScreen: async (id: string, input: Partial<ScreenCreateInput> & { playlistId?: string | null; status?: string }) => {
    const store = getDemoStore();
    const screen = findScreen(id, store);
    const updated: ScreenDto = {
      ...screen,
      name: input.name ?? screen.name,
      slug: input.slug ?? screen.slug,
      location: input.location === undefined ? screen.location : input.location,
      orientation: input.orientation ?? screen.orientation,
      activePlaylistId: input.playlistId === undefined ? screen.activePlaylistId : input.playlistId,
      status: input.status === "online" || input.status === "offline" ? input.status : screen.status,
      updatedAt: new Date().toISOString()
    };
    store.screens = store.screens.map((item) => (item.id === id ? updated : item));
    saveDemoStore(store);
    return updated;
  },
  deleteScreen: async (id: string) => {
    const store = getDemoStore();
    findScreen(id, store);
    store.screens = store.screens.filter((item) => item.id !== id);
    saveDemoStore(store);
    return { id };
  }
};

function getDemoStore(): DemoStore {
  const rawStore = window.localStorage.getItem(DEMO_STORE_KEY);
  if (rawStore) {
    return JSON.parse(rawStore) as DemoStore;
  }
  const store = createInitialDemoStore();
  saveDemoStore(store);
  return store;
}

function saveDemoStore(store: DemoStore) {
  window.localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
}

function createInitialDemoStore(): DemoStore {
  const now = new Date().toISOString();
  const welcomeMedia: MediaDto = {
    id: "media-welcome",
    title: "Imagem de boas-vindas",
    type: "image",
    fileUrl: "https://cdn.example.com/demo/welcome.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 420000,
    durationSeconds: null,
    status: "ready",
    orientation: "landscape",
    rotationDegrees: 0,
    processingError: null,
    readyAt: now,
    createdAt: now,
    updatedAt: now
  };
  const promoMedia: MediaDto = {
    id: "media-promo",
    title: "Vídeo promocional",
    type: "video",
    fileUrl: "https://cdn.example.com/demo/promo.mp4",
    mimeType: "video/mp4",
    sizeBytes: 8400000,
    durationSeconds: 30,
    status: "ready",
    orientation: "landscape",
    rotationDegrees: 0,
    processingError: null,
    readyAt: now,
    createdAt: now,
    updatedAt: now
  };
  const menuMedia: MediaDto = {
    id: "media-menu",
    title: "Cardápio digital",
    type: "image",
    fileUrl: "https://cdn.example.com/demo/menu.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 610000,
    durationSeconds: null,
    status: "ready",
    orientation: "portrait",
    rotationDegrees: 0,
    processingError: null,
    readyAt: now,
    createdAt: now,
    updatedAt: now
  };
  const media: MediaDto[] = [
    welcomeMedia,
    promoMedia,
    menuMedia
  ];
  const playlist: PlaylistDto = {
    id: "playlist-lobby",
    name: "Playlist de demonstração da recepção",
    description: "Playlist de exemplo para a tela de demonstração.",
    isActive: true,
    scheduledStartAt: null,
    scheduledEndAt: null,
    createdAt: now,
    updatedAt: now,
    items: [
      { id: "item-welcome", mediaId: welcomeMedia.id, order: 1, displayDurationSeconds: 10, media: welcomeMedia },
      { id: "item-promo", mediaId: promoMedia.id, order: 2, displayDurationSeconds: null, media: promoMedia },
      { id: "item-menu", mediaId: menuMedia.id, order: 3, displayDurationSeconds: 15, media: menuMedia }
    ]
  };

  return {
    media,
    playlists: [playlist],
    screens: [
      {
        id: "screen-lobby",
        name: "Tela de demonstração da recepção",
        slug: "demo-lobby",
        location: "Recepção",
        orientation: "landscape",
        activationCode: "DEMO01",
        deviceKeyRegistered: false,
        status: "online",
        activePlaylistId: playlist.id,
        lastSeenAt: now,
        lastHeartbeatAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

function findPlaylist(id: string, store = getDemoStore()) {
  const playlist = store.playlists.find((item) => item.id === id);
  if (!playlist) throw new ApiClientError("Playlist não encontrada.", 404);
  return playlist;
}

function replacePlaylist(store: DemoStore, playlist: PlaylistDto) {
  store.playlists = store.playlists.map((item) => (item.id === playlist.id ? playlist : item));
  saveDemoStore(store);
  return playlist;
}

function findScreen(id: string, store = getDemoStore()) {
  const screen = store.screens.find((item) => item.id === id);
  if (!screen) throw new ApiClientError("Tela não encontrada.", 404);
  return screen;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createActivationCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
