"use client";

import type {
  AccountDto,
  CompanyDto,
  DashboardDto,
  FooterConfig,
  MediaDto,
  MediaType,
  NotificationDto,
  PlaylistDto,
  RemoteControlKey,
  ReportDto,
  ScheduleDto,
  ScreenCommandDto,
  ScreenCommandType,
  ScreenDetailDto,
  ScreenDto,
  ScreenEventDto,
  ScreenItemDto,
  ScreenMirrorCandidateDto,
  ScreenMirrorSessionDto,
  SessionDto,
  UserDto,
  CurrencyQuote,
  RssItem,
  WeatherData
} from "@dialindooh/shared";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

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

async function request<T>(path: string, method: HttpMethod = "GET", body?: unknown) {
  const response = await fetch(path, {
    cache: "no-store",
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined
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

function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "" && value !== false) {
      search.set(key, value === true ? "1" : String(value));
    }
  }

  const text = search.toString();
  return text ? `?${text}` : "";
}

export interface MediaUploadUrlResponse {
  provider?: "supabase" | "r2";
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

export interface MediaInput {
  title?: string;
  type?: MediaType;
  companyId?: string | null;
  category?: string | null;
  fileUrl?: string | null;
  fileUrlVertical?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sizeBytesVertical?: number | null;
  durationSeconds?: number | null;
  config?: Record<string, unknown> | null;
  recordStats?: boolean;
  isLibrary?: boolean;
  schedule?: ScheduleDto | null;
  screenIds?: string[];
}

export interface PlaylistInput {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  isActive?: boolean;
  isLibrary?: boolean;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  mediaIds?: string[];
  screenIds?: string[];
}

export type ScreenInput = Partial<
  Omit<
    ScreenDto,
    | "id"
    | "accountId"
    | "companyName"
    | "activationCode"
    | "deviceKeyRegistered"
    | "status"
    | "activePlaylistId"
    | "itemCount"
    | "totalSeconds"
    | "diagnostics"
    | "lastSeenAt"
    | "lastHeartbeatAt"
    | "createdAt"
    | "updatedAt"
  >
>;

export interface ScreenItemInput {
  mediaId?: string | null;
  playlistId?: string | null;
  durationSeconds?: number | null;
}

export interface UserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: "admin" | "operator";
  avatarUrl?: string | null;
  timezone?: string | null;
  restrictContent?: boolean;
  screenIds?: string[];
  isActive?: boolean;
}

export interface AccountSettingsDto extends AccountDto {
  footer: FooterConfig;
}

export const apiClient = {
  /* sessão */
  login: (email: string, password: string) => request<{ user: { id: string; name: string } }>("/api/auth/login", "POST", { email, password }),
  logout: () => request("/api/auth/logout", "POST"),
  getSession: () => request<SessionDto>("/api/session"),
  switchAccount: (accountId: string | null) => request("/api/session/account", "POST", { accountId }),
  updateProfile: (input: { name?: string; avatarUrl?: string | null; timezone?: string | null; currentPassword?: string; newPassword?: string }) =>
    request<UserDto>("/api/session/profile", "PATCH", input),
  getBranding: () => request<{ name: string; logoUrl: string | null; loginImageUrl: string | null; primaryColor: string | null }>("/api/public/branding"),

  /* conta atual */
  getAccount: () => request<AccountSettingsDto>("/api/account"),
  updateAccount: (input: Partial<Omit<AccountSettingsDto, "footer">> & { footer?: FooterConfig }) =>
    request<AccountDto>("/api/account", "PATCH", input),

  /* clientes */
  listAccounts: () => request<AccountDto[]>("/api/accounts"),
  createAccount: (input: { name: string; kind?: "client" | "reseller"; maxScreens?: number | null; maxInstagram?: number; admin: { name: string; email: string; password: string } }) =>
    request<AccountDto>("/api/accounts", "POST", input),
  updateAccountAdmin: (id: string, input: { name?: string; isActive?: boolean; maxScreens?: number | null; maxInstagram?: number }) =>
    request<AccountDto>(`/api/accounts/${id}`, "PATCH", input),
  deleteAccount: (id: string) => request(`/api/accounts/${id}`, "DELETE"),

  /* empresas */
  listCompanies: () => request<CompanyDto[]>("/api/companies"),
  createCompany: (input: { name: string; document?: string | null; contact?: string | null; phone?: string | null }) =>
    request<CompanyDto>("/api/companies", "POST", input),
  updateCompany: (id: string, input: { name?: string; document?: string | null; contact?: string | null; phone?: string | null }) =>
    request<CompanyDto>(`/api/companies/${id}`, "PATCH", input),
  deleteCompany: (id: string) => request(`/api/companies/${id}`, "DELETE"),

  /* usuários */
  listUsers: () => request<UserDto[]>("/api/users"),
  createUser: (input: UserInput) => request<UserDto>("/api/users", "POST", input),
  updateUser: (id: string, input: UserInput) => request<UserDto>(`/api/users/${id}`, "PATCH", input),
  deleteUser: (id: string) => request(`/api/users/${id}`, "DELETE"),

  /* mídias */
  listMedia: (filters: { type?: string; companyId?: string; q?: string; library?: boolean } = {}) =>
    request<MediaDto[]>(`/api/media${query(filters)}`),
  getMedia: (id: string) => request<MediaDto>(`/api/media/${id}`),
  createMediaUploadUrl: (input: { fileName: string; mimeType: string; sizeBytes: number }) =>
    request<MediaUploadUrlResponse>("/api/media/upload-url", "POST", input),
  createMedia: (input: MediaInput) => request<MediaDto>("/api/media", "POST", input),
  updateMedia: (id: string, input: MediaInput) => request<MediaDto>(`/api/media/${id}`, "PATCH", input),
  deleteMedia: (id: string) => request<{ id: string }>(`/api/media/${id}`, "DELETE"),
  deleteMediaMany: (ids: string[]) => request<{ deleted: string[]; skipped: string[] }>("/api/media/bulk-delete", "POST", { ids }),
  getMediaScreens: (id: string) => request<string[]>(`/api/media/${id}/screens`),
  includeMediaInScreens: (id: string, screenIds: string[]) => request(`/api/media/${id}/screens`, "POST", { screenIds }),

  /* grupos */
  listPlaylists: (filters: { library?: boolean } = {}) => request<PlaylistDto[]>(`/api/playlists${query(filters)}`),
  getPlaylist: (id: string) => request<PlaylistDto>(`/api/playlists/${id}`),
  createPlaylist: (input: PlaylistInput) => request<PlaylistDto>("/api/playlists", "POST", input),
  updatePlaylist: (id: string, input: PlaylistInput) => request<PlaylistDto>(`/api/playlists/${id}`, "PATCH", input),
  deletePlaylist: (id: string) => request<{ id: string }>(`/api/playlists/${id}`, "DELETE"),
  getPlaylistScreens: (id: string) => request<string[]>(`/api/playlists/${id}/screens`),
  includePlaylistInScreens: (id: string, screenIds: string[]) => request(`/api/playlists/${id}/screens`, "POST", { screenIds }),

  /* telas */
  listScreens: (filters: { status?: string; q?: string; favorites?: boolean } = {}) =>
    request<ScreenDto[]>(`/api/screens${query(filters)}`),
  createScreen: (input: ScreenInput & { name: string }) => request<ScreenDto>("/api/screens", "POST", input),
  getScreen: (id: string) => request<ScreenDetailDto>(`/api/screens/${id}`),
  updateScreen: (id: string, input: ScreenInput & { playlistId?: string | null }) =>
    request<ScreenDto>(`/api/screens/${id}`, "PATCH", input),
  deleteScreen: (id: string) => request<{ id: string }>(`/api/screens/${id}`, "DELETE"),
  duplicateScreen: (id: string) => request<ScreenDto>(`/api/screens/${id}/duplicate`, "POST"),
  resetScreenPairing: (id: string) => request<ScreenDto>(`/api/screens/${id}/reset-pairing`, "POST"),
  replaceScreenItems: (id: string, items: ScreenItemInput[]) => request<ScreenItemDto[]>(`/api/screens/${id}/items`, "PUT", { items }),
  addScreenItem: (id: string, item: ScreenItemInput) => request<ScreenItemDto[]>(`/api/screens/${id}/items`, "POST", item),
  removeScreenItem: (id: string, itemId: string) => request<ScreenItemDto[]>(`/api/screens/${id}/items/${itemId}`, "DELETE"),
  listScreenEvents: (id: string) => request<ScreenEventDto[]>(`/api/screens/${id}/events`),
  createScreenCommand: (id: string, type: ScreenCommandType, payload?: Record<string, unknown> | null) =>
    request<ScreenCommandDto>(`/api/screens/${id}/commands`, "POST", { type, payload }),
  createScreenMirrorSession: (screenId: string) => request<ScreenMirrorSessionDto>(`/api/screens/${screenId}/mirror-sessions`, "POST"),
  getScreenMirrorSession: (screenId: string, sessionId: string) =>
    request<ScreenMirrorSessionDto>(`/api/screens/${screenId}/mirror-sessions/${sessionId}`),
  updateScreenMirrorSession: (
    screenId: string,
    sessionId: string,
    input: { status?: ScreenMirrorSessionDto["status"]; answer?: RTCSessionDescriptionInit | null; errorMessage?: string | null }
  ) => request<ScreenMirrorSessionDto>(`/api/screens/${screenId}/mirror-sessions/${sessionId}`, "PATCH", input),
  stopScreenMirrorSession: (screenId: string, sessionId: string) =>
    request<ScreenMirrorSessionDto>(`/api/screens/${screenId}/mirror-sessions/${sessionId}`, "DELETE"),
  listScreenMirrorCandidates: (screenId: string, sessionId: string) =>
    request<ScreenMirrorCandidateDto[]>(`/api/screens/${screenId}/mirror-sessions/${sessionId}/candidates`),
  createScreenMirrorCandidate: (screenId: string, sessionId: string, input: Pick<ScreenMirrorCandidateDto, "peer" | "candidate">) =>
    request<ScreenMirrorCandidateDto>(`/api/screens/${screenId}/mirror-sessions/${sessionId}/candidates`, "POST", input),

  /* conteúdos dinâmicos */
  previewWidget: (input: { type: "currency" | "weather" | "rss"; currencies?: string[]; city?: string | null; state?: string | null; url?: string; maxItems?: number }) =>
    request<{ quotes?: CurrencyQuote[]; weather?: WeatherData | null; rss?: RssItem[] }>("/api/widgets/preview", "POST", input),
  verifyInstagram: (accessToken: string) => request<{ username: string; id: string }>("/api/widgets/instagram", "POST", { accessToken }),
  listRssSources: () => request<Array<{ id: string; name: string; url: string; accountId: string | null }>>("/api/rss-sources"),
  createRssSource: (input: { name: string; url: string }) => request("/api/rss-sources", "POST", input),
  deleteRssSource: (id: string) => request(`/api/rss-sources/${id}`, "DELETE"),

  /* relatórios */
  getDashboard: () => request<DashboardDto>("/api/dashboard"),
  getNotifications: () => request<NotificationDto[]>("/api/notifications"),
  getReport: (filters: { from: string; to: string; mediaId?: string; playlistId?: string; screenId?: string; companyId?: string }) =>
    request<ReportDto>(`/api/reports${query(filters)}`),
  reportExportUrl: (
    format: "pdf" | "xlsx",
    filters: { from: string; to: string; mediaId?: string; playlistId?: string; screenId?: string; companyId?: string }
  ) => `/api/reports/export${query({ ...filters, format })}`
};

export type { RemoteControlKey };

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    const details = error.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | undefined;
    const fieldMessage = details?.fieldErrors ? Object.values(details.fieldErrors).flat()[0] : undefined;
    const formMessage = details?.formErrors?.[0];
    return fieldMessage ?? formMessage ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Ocorreu um erro inesperado.";
}
