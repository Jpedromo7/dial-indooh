export type FileMediaType = "image" | "video";

export type WidgetMediaType = "clock" | "currency" | "weather" | "rss" | "notice" | "instagram";

export type MediaType = FileMediaType | "youtube" | "url" | WidgetMediaType;

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  image: "Imagem",
  video: "Vídeo",
  youtube: "YouTube",
  url: "Link externo",
  clock: "Hora certa",
  currency: "Cotação",
  weather: "Clima",
  rss: "Notícias RSS",
  notice: "Aviso",
  instagram: "Instagram"
};

export type MediaStatus = "pending" | "processing" | "ready" | "failed";

export type MediaOrientation = "auto" | "landscape" | "portrait" | "square";

export type MediaRotation = 0 | 90 | 180 | 270;

export type ScreenStatus = "online" | "offline";

export type ScreenOrientation = "landscape" | "portrait";

export type ScreenEventLevel = "info" | "warn" | "error";

export type PlaybackState = "idle" | "playing" | "paused" | "transitioning" | "error";

export type RemoteControlKey = "up" | "down" | "left" | "right" | "select" | "back";

export type ScreenMirrorSessionStatus = "requested" | "connecting" | "active" | "ended" | "failed";

export type ScreenMirrorPeer = "screen" | "viewer";

export type ScreenCommandType =
  | "refresh_playlist"
  | "clear_cache"
  | "restart_player"
  | "reload_app"
  | "open_overlay_settings"
  | "remote_key"
  | "start_screen_mirror"
  | "stop_screen_mirror";

export type ScreenCommandStatus = "pending" | "delivered" | "acknowledged" | "failed";

export type UserRole = "superadmin" | "admin" | "operator";

export type AccountKind = "reseller" | "client";

export const SCREEN_SEGMENTS = [
  "Geral",
  "Academias",
  "Bares e restaurantes",
  "Clínicas e consultórios",
  "Corporativos",
  "Escolas",
  "Farmácias",
  "Hotéis",
  "Indústrias",
  "Lanchonetes",
  "Lojas",
  "Lotéricas",
  "Padarias",
  "Salões e barbearias",
  "Shoppings",
  "Supermercados",
  "Outros"
] as const;

export const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

/** Agenda de exibição. weekdays: 0 = domingo … 6 = sábado; vazio = todos os dias. Horários "HH:MM". */
export interface ScheduleDto {
  startsAt: string | null;
  endsAt: string | null;
  timeFrom: string | null;
  timeTo: string | null;
  weekdays: number[];
}

export interface ClockConfig {
  background: string;
  color: string;
  logoUrl?: string | null;
}

export interface CurrencyConfig {
  background: string;
  color: string;
  currencies: string[];
}

export interface WeatherConfig {
  background: string;
  color: string;
  /** Cidade fixa; vazio usa a cidade cadastrada no terminal. */
  city?: string | null;
  state?: string | null;
}

export interface RssConfig {
  url: string;
  source?: string | null;
  background: string;
  color: string;
  logoUrl?: string | null;
  maxItems: number;
}

export interface NoticeConfig {
  text: string;
  subtitle?: string | null;
  background: string;
  color: string;
  imageUrl?: string | null;
}

export interface InstagramConfig {
  postsCount: 1 | 3;
  background: string;
  color: string;
  profileImageUrl?: string | null;
  username?: string | null;
  /** Indica se há token salvo (o token nunca sai do servidor). */
  connected?: boolean;
  tokenExpiresAt?: string | null;
}

export interface YoutubeConfig {
  url: string;
  videoId: string;
}

export interface UrlConfig {
  url: string;
  /** Recarregar a página a cada exibição. */
  reload?: boolean;
}

export type MediaConfig =
  | ClockConfig
  | CurrencyConfig
  | WeatherConfig
  | RssConfig
  | NoticeConfig
  | InstagramConfig
  | YoutubeConfig
  | UrlConfig
  | Record<string, unknown>;

export interface MediaDto {
  id: string;
  accountId: string | null;
  companyId: string | null;
  companyName?: string | null;
  title: string;
  type: MediaType;
  category: string | null;
  fileUrl: string;
  fileUrlVertical: string | null;
  thumbnailUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  status: MediaStatus;
  orientation: MediaOrientation;
  rotationDegrees: MediaRotation;
  processingError: string | null;
  readyAt: string | null;
  config: MediaConfig | null;
  recordStats: boolean;
  isLibrary: boolean;
  schedule: ScheduleDto;
  screenCount?: number;
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

/** "Grupo" no painel. */
export interface PlaylistDto {
  id: string;
  accountId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  isLibrary: boolean;
  isActive: boolean;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  items: PlaylistItemDto[];
  screenCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenDiagnosticsDto {
  freeDiskBytes?: number | null;
  totalDiskBytes?: number | null;
  cachedItems?: number | null;
  totalItems?: number | null;
  appVersion?: string | null;
  deviceModel?: string | null;
  osVersion?: string | null;
  overlayPermission?: boolean | null;
}

export interface ScreenDto {
  id: string;
  accountId: string | null;
  companyId: string | null;
  companyName: string | null;
  name: string;
  slug: string;
  location: string | null;
  imageUrl: string | null;
  segment: string | null;
  street: string | null;
  streetNumber: string | null;
  complement: string | null;
  zipCode: string | null;
  district: string | null;
  state: string | null;
  city: string | null;
  phone1: string | null;
  phone2: string | null;
  openFrom: string | null;
  openTo: string | null;
  openDays: number[];
  footfall: number | null;
  socialClasses: string[];
  refreshMinutes: number;
  soundEnabled: boolean;
  timezone: string;
  footerEnabled: boolean;
  notes: string | null;
  isFavorite: boolean;
  shuffle: boolean;
  orientation: ScreenOrientation;
  activationCode: string | null;
  deviceKeyRegistered: boolean;
  status: ScreenStatus;
  activePlaylistId: string | null;
  itemCount: number;
  totalSeconds: number;
  diagnostics: ScreenDiagnosticsDto | null;
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

export interface ScreenMirrorSessionDto {
  id: string;
  screenId: string;
  status: ScreenMirrorSessionStatus;
  requestedById: string | null;
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
}

export interface ScreenMirrorCandidateDto {
  id: string;
  sessionId: string;
  peer: ScreenMirrorPeer;
  candidate: RTCIceCandidateInit;
  createdAt: string;
}

export interface ScreenItemDto {
  id: string;
  order: number;
  durationSeconds: number | null;
  mediaId: string | null;
  playlistId: string | null;
  media: MediaDto | null;
  playlist: {
    id: string;
    name: string;
    imageUrl: string | null;
    isLibrary: boolean;
    itemCount: number;
    totalSeconds: number;
  } | null;
}

export interface MonthlyPlaysDto {
  month: string;
  plays: number;
}

export interface ScreenDetailDto extends ScreenDto {
  items: ScreenItemDto[];
  lastHeartbeat: ScreenHeartbeatDto | null;
  recentEvents: ScreenEventDto[];
  recentCommands: ScreenCommandDto[];
  monthlyPlays: MonthlyPlaysDto[];
}

export interface AccountDto {
  id: string;
  name: string;
  kind: AccountKind;
  parentId: string | null;
  isActive: boolean;
  logoUrl: string | null;
  loginImageUrl: string | null;
  splashUrl: string | null;
  splashEnabled: boolean;
  primaryColor: string | null;
  maxScreens: number | null;
  maxInstagram: number;
  apkUrl: string | null;
  screenCount?: number;
  userCount?: number;
  createdAt: string;
}

export interface CompanyDto {
  id: string;
  accountId: string;
  name: string;
  document: string | null;
  contact: string | null;
  phone: string | null;
  screenCount: number;
  mediaCount: number;
  createdAt: string;
}

export interface UserDto {
  id: string;
  accountId: string | null;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  timezone: string | null;
  isActive: boolean;
  restrictContent: boolean;
  screenIds: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SessionDto {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl: string | null;
    timezone: string | null;
  };
  account: AccountDto;
  accounts: Array<{ id: string; name: string; kind: AccountKind }>;
  isSuperadmin: boolean;
  isAdmin: boolean;
  restricted: boolean;
}

export interface FooterConfig {
  logoUrl: string | null;
  background: string;
  color: string;
  phrase: string;
  showPhrase: boolean;
  showDate: boolean;
  showTime: boolean;
  showWeather: boolean;
  showIcons: boolean;
  /** Mostrar manchetes de um feed RSS rolando no rodapé. */
  rssUrl: string | null;
  speed: "slow" | "normal" | "fast";
}

export const DEFAULT_FOOTER: FooterConfig = {
  logoUrl: null,
  background: "#111827",
  color: "#ffffff",
  phrase: "Bem-vindo!",
  showPhrase: true,
  showDate: true,
  showTime: true,
  showWeather: true,
  showIcons: true,
  rssUrl: null,
  speed: "normal"
};

/* ---------- Manifesto entregue à TV (v2) ---------- */

export interface WeatherData {
  city: string;
  temperature: number;
  apparentTemperature?: number | null;
  description: string;
  icon: string;
  max?: number | null;
  min?: number | null;
  forecast?: Array<{ date: string; max: number; min: number; icon: string; description: string }>;
}

export interface CurrencyQuote {
  code: string;
  name: string;
  bid: number;
  pctChange: number;
}

export interface RssItem {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
}

export interface InstagramPost {
  id: string;
  imageUrl: string;
  caption?: string | null;
  timestamp?: string | null;
  likeCount?: number | null;
}

export interface ManifestItem {
  /** Identificador único da posição na lista (screenItemId[:mediaId]). */
  key: string;
  mediaId: string;
  playlistId: string | null;
  type: MediaType;
  title: string;
  durationSeconds: number;
  fileUrl: string | null;
  mimeType: string | null;
  rotationDegrees: MediaRotation;
  schedule: ScheduleDto;
  recordStats: boolean;
  config: MediaConfig | null;
  data: {
    weather?: WeatherData | null;
    quotes?: CurrencyQuote[];
    rss?: RssItem[];
    posts?: InstagramPost[];
  } | null;
}

export interface DeviceManifest {
  version: 2;
  generatedAt: string;
  screen: {
    id: string;
    name: string;
    orientation: ScreenOrientation;
    soundEnabled: boolean;
    timezone: string;
    refreshMinutes: number;
    footerEnabled: boolean;
    shuffle: boolean;
  };
  branding: {
    logoUrl: string | null;
    splashUrl: string | null;
  };
  footer: (FooterConfig & { weather: WeatherData | null; headlines: string[] }) | null;
  items: ManifestItem[];
}

export interface PlayLogInput {
  id: string;
  mediaId: string;
  playlistId?: string | null;
  startedAt: string;
  durationSeconds: number;
}

/* ---------- Relatórios ---------- */

export interface ReportRow {
  screenId: string;
  screenName: string;
  plays: number;
  seconds: number;
  lastPlayedAt: string | null;
}

export interface ReportDto {
  from: string;
  to: string;
  generatedAt: string;
  generatedBy: string;
  mediaTitle: string | null;
  playlistName: string | null;
  totalPlays: number;
  totalSeconds: number;
  campaignDays: number;
  screenCount: number;
  rows: ReportRow[];
  daily: Array<{ date: string; plays: number }>;
}

export interface DashboardDto {
  screens: { total: number; online: number; offline: number };
  monthlyPlays: MonthlyPlaysDto[];
  playsThisMonth: number;
  playsLastMonth: number;
  health: Array<{ date: string; onlinePct: number }>;
  topScreens: Array<{ id: string; name: string; plays: number }>;
  favorites: ScreenDto[];
  mediaCount: number;
  playlistCount: number;
  notifications: NotificationDto[];
}

export interface NotificationDto {
  id: string;
  level: "info" | "warn" | "error";
  title: string;
  message: string;
  href?: string | null;
  createdAt: string;
}

export interface ActivationRequest {
  activationCode: string;
  deviceName?: string;
  appVersion?: string;
}

export interface ActivationResponse {
  screenId: string;
  deviceKey: string;
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
export * from "./schedule";
