import { z } from "zod";

const id = z.string().min(1, "O ID obrigatório está ausente.");
const optionalText = z.string().trim().max(500).nullable().optional().transform((value) => (value ? value : value === "" ? null : value));
const shortText = (max = 160) => z.string().trim().max(max).nullable().optional().transform((value) => (value === "" ? null : value));
const optionalDateTime = z.string().datetime({ offset: true }).nullable().optional();
const timeOfDay = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM.")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB).");
const metadata = z.record(z.unknown()).nullable().optional();
const screenOrientation = z.enum(["landscape", "portrait"]);
const mediaRotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const playbackState = z.enum(["idle", "playing", "paused", "transitioning", "error"]);
const remoteControlKey = z.enum(["up", "down", "left", "right", "select", "back"]);
const screenMirrorSessionStatus = z.enum(["requested", "connecting", "active", "ended", "failed"]);
const screenMirrorPeer = z.enum(["screen", "viewer"]);
const weekdays = z.array(z.number().int().min(0).max(6)).max(7);
const timezone = z.string().trim().min(3).max(64);
const rtcSessionDescription = z
  .object({
    type: z.enum(["offer", "answer", "pranswer", "rollback"]),
    sdp: z.string().min(1)
  })
  .passthrough();
const rtcIceCandidate = z
  .object({
    candidate: z.string().min(1),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
    usernameFragment: z.string().nullable().optional()
  })
  .passthrough();
const screenCommandType = z.enum([
  "refresh_playlist",
  "clear_cache",
  "restart_player",
  "reload_app",
  "open_overlay_settings",
  "remote_key",
  "start_screen_mirror",
  "stop_screen_mirror"
]);
const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens.");

export const mediaTypeSchema = z.enum([
  "image",
  "video",
  "youtube",
  "url",
  "clock",
  "currency",
  "weather",
  "rss",
  "notice",
  "instagram",
  "quote",
  "countdown",
  "holidays",
  "birthdays",
  "qrcode"
]);

export const scheduleSchema = z.object({
  startsAt: optionalDateTime,
  endsAt: optionalDateTime,
  timeFrom: timeOfDay,
  timeTo: timeOfDay,
  weekdays: weekdays.default([])
});

export const idParamsSchema = z.object({ id });

export const screenMirrorSessionParamsSchema = z.object({ id, sessionId: id });

export const mediaIdParamsSchema = z.object({ id });

export const playlistItemParamsSchema = z.object({ id, itemId: id });

export const screenItemParamsSchema = z.object({ id, itemId: id });

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(200)
});

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(200)
  .regex(/[A-Za-z]/, "A senha precisa ter letras.")
  .regex(/\d/, "A senha precisa ter números.");

/* ---------- Configurações dos widgets ---------- */

export const clockConfigSchema = z.object({
  background: color.default("#1d4ed8"),
  color: color.default("#ffffff"),
  logoUrl: z.string().url().nullable().optional()
});

export const currencyConfigSchema = z.object({
  background: color.default("#6d28d9"),
  color: color.default("#ffffff"),
  currencies: z.array(z.enum(["USD", "EUR", "GBP", "ARS", "BTC"])).min(1).max(3).default(["USD"])
});

export const weatherConfigSchema = z.object({
  background: color.default("#0369a1"),
  color: color.default("#ffffff"),
  city: shortText(120),
  state: shortText(2)
});

export const rssConfigSchema = z.object({
  url: z.string().trim().url("Informe a URL do feed RSS."),
  source: shortText(80),
  background: color.default("#111827"),
  color: color.default("#ffffff"),
  logoUrl: z.string().url().nullable().optional(),
  maxItems: z.number().int().min(1).max(10).default(5)
});

export const noticeConfigSchema = z.object({
  text: z.string().trim().min(1, "Escreva o aviso.").max(280),
  subtitle: shortText(200),
  background: color.default("#b91c1c"),
  color: color.default("#ffffff"),
  imageUrl: z.string().url().nullable().optional()
});

export const instagramConfigSchema = z.object({
  postsCount: z.union([z.literal(1), z.literal(3)]).default(1),
  background: color.default("#111827"),
  color: color.default("#ffffff"),
  profileImageUrl: z.string().url().nullable().optional(),
  username: shortText(80),
  accessToken: z.string().trim().min(20).max(1000).optional()
});

export const quoteConfigSchema = z.object({
  theme: z.enum(["motivacional", "curiosidades", "saude", "personalizado"]).default("motivacional"),
  title: shortText(80),
  phrases: z.array(z.string().trim().min(1).max(280)).max(100).default([]),
  background: color.default("#0f766e"),
  color: color.default("#ffffff")
});

export const countdownConfigSchema = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(120),
  target: z.string().datetime({ offset: true }),
  finishedText: shortText(160),
  background: color.default("#be123c"),
  color: color.default("#ffffff"),
  imageUrl: z.string().url().nullable().optional()
});

export const holidaysConfigSchema = z.object({
  title: shortText(80),
  count: z.number().int().min(1).max(6).default(4),
  background: color.default("#15803d"),
  color: color.default("#ffffff")
});

export const birthdaysConfigSchema = z.object({
  title: shortText(80),
  people: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        day: z.number().int().min(1).max(31),
        month: z.number().int().min(1).max(12),
        role: shortText(60)
      })
    )
    .max(500)
    .default([]),
  background: color.default("#c026d3"),
  color: color.default("#ffffff")
});

export const qrcodeConfigSchema = z.object({
  kind: z.enum(["url", "whatsapp", "instagram", "wifi", "text"]).default("url"),
  value: z.string().trim().min(1, "Informe o conteúdo do QR Code.").max(500),
  title: z.string().trim().min(1).max(120),
  subtitle: shortText(200),
  wifiPassword: shortText(120),
  background: color.default("#1e293b"),
  color: color.default("#ffffff")
});

export const youtubeConfigSchema = z.object({
  url: z.string().trim().url("Informe o link do YouTube.")
});

export const urlConfigSchema = z.object({
  url: z
    .string()
    .trim()
    .url("Informe uma URL válida.")
    .refine((value) => value.startsWith("https://"), "Use um endereço HTTPS."),
  reload: z.boolean().optional()
});

/* ---------- Mídias ---------- */

export const mediaCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: mediaTypeSchema,
  companyId: id.nullable().optional(),
  category: shortText(80),
  fileUrl: z.string().trim().url().nullable().optional(),
  fileUrlVertical: z.string().trim().url().nullable().optional(),
  thumbnailUrl: z.string().trim().url().nullable().optional(),
  mimeType: z.string().trim().max(120).nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  sizeBytesVertical: z.number().int().nonnegative().nullable().optional(),
  durationSeconds: z.number().int().positive().max(24 * 60 * 60).nullable().optional(),
  orientation: z.enum(["auto", "landscape", "portrait", "square"]).optional(),
  rotationDegrees: mediaRotation.optional(),
  config: z.record(z.unknown()).nullable().optional(),
  recordStats: z.boolean().optional(),
  isLibrary: z.boolean().optional(),
  schedule: scheduleSchema.nullable().optional(),
  screenIds: z.array(id).max(500).optional()
});

export const mediaUpdateSchema = mediaCreateSchema
  .omit({ type: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe pelo menos um campo." });

export const mediaUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive()
});

export const bulkDeleteSchema = z.object({
  ids: z.array(id).min(1).max(200)
});

export const includeInScreensSchema = z.object({
  screenIds: z.array(id).min(1).max(500)
});

/* ---------- Grupos ---------- */

export const playlistCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: optionalText,
  imageUrl: z.string().trim().url().nullable().optional(),
  category: shortText(80),
  isActive: z.boolean().optional(),
  isLibrary: z.boolean().optional(),
  scheduledStartAt: optionalDateTime,
  scheduledEndAt: optionalDateTime,
  mediaIds: z.array(id).max(500).optional(),
  screenIds: z.array(id).max(500).optional()
});

export const playlistUpdateSchema = playlistCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe pelo menos um campo." });

export const playlistItemCreateSchema = z.object({
  mediaId: id,
  order: z.number().int().positive().optional(),
  displayDurationSeconds: z.number().int().positive().nullable().optional()
});

export const playlistItemUpdateSchema = z.object({
  displayDurationSeconds: z.number().int().positive().nullable()
});

export const playlistItemsReorderSchema = z.object({
  items: z.array(z.object({ id, order: z.number().int().positive() })).min(1)
});

/* ---------- Telas ---------- */

const screenFields = {
  name: z.string().trim().min(1).max(160),
  slug: slug.optional(),
  location: optionalText,
  orientation: screenOrientation.optional(),
  companyId: id.nullable().optional(),
  imageUrl: z.string().trim().url().nullable().optional(),
  segment: shortText(80),
  street: shortText(160),
  streetNumber: shortText(20),
  complement: shortText(120),
  zipCode: shortText(12),
  district: shortText(120),
  state: shortText(2),
  city: shortText(120),
  phone1: shortText(30),
  phone2: shortText(30),
  openFrom: timeOfDay,
  openTo: timeOfDay,
  openDays: weekdays.optional(),
  footfall: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  socialClasses: z.array(z.enum(["A", "B", "C", "D"])).max(4).optional(),
  refreshMinutes: z.number().int().min(1).max(240).optional(),
  soundEnabled: z.boolean().optional(),
  timezone: timezone.optional(),
  footerEnabled: z.boolean().optional(),
  notes: z.string().max(20_000).nullable().optional(),
  isFavorite: z.boolean().optional(),
  shuffle: z.boolean().optional()
};

export const screenCreateSchema = z.object(screenFields);

export const screenUpdateSchema = z
  .object(screenFields)
  .partial()
  .extend({ playlistId: id.nullable().optional() })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe pelo menos um campo." });

export const screenItemCreateSchema = z
  .object({
    mediaId: id.optional(),
    playlistId: id.optional(),
    durationSeconds: z.number().int().positive().max(3600).nullable().optional()
  })
  .refine((value) => Boolean(value.mediaId) !== Boolean(value.playlistId), {
    message: "Informe uma mídia ou um grupo."
  });

export const screenItemsReplaceSchema = z.object({
  items: z
    .array(
      z
        .object({
          mediaId: id.nullable().optional(),
          playlistId: id.nullable().optional(),
          durationSeconds: z.number().int().positive().max(3600).nullable().optional()
        })
        .refine((value) => Boolean(value.mediaId) !== Boolean(value.playlistId), {
          message: "Cada item precisa ser uma mídia ou um grupo."
        })
    )
    .max(500)
});

export const screenActivationSchema = z.object({
  activationCode: z
    .string()
    .trim()
    .min(4)
    .max(16)
    .transform((value) => value.toUpperCase())
});

export const screenHeartbeatSchema = z.object({
  status: z.enum(["online", "offline"]),
  appVersion: z.string().trim().min(1).max(40).optional(),
  ipAddress: z.string().trim().min(3).max(80).optional(),
  currentMediaId: id.nullable().optional(),
  currentPlaylistItemId: id.nullable().optional(),
  playbackPositionSeconds: z.number().finite().nonnegative().nullable().optional(),
  playbackDurationSeconds: z.number().finite().positive().nullable().optional(),
  playbackState: playbackState.nullable().optional(),
  sentAt: z.string().datetime().optional(),
  diagnostics: z
    .object({
      freeDiskBytes: z.number().nonnegative().nullable().optional(),
      totalDiskBytes: z.number().nonnegative().nullable().optional(),
      cachedItems: z.number().int().nonnegative().nullable().optional(),
      totalItems: z.number().int().nonnegative().nullable().optional(),
      deviceModel: z.string().max(120).nullable().optional(),
      osVersion: z.string().max(40).nullable().optional(),
      overlayPermission: z.boolean().nullable().optional()
    })
    .optional()
});

export const screenEventSchema = z.object({
  level: z.enum(["info", "warn", "error"]).default("info"),
  type: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  mediaId: id.nullable().optional(),
  metadata
});

export const playLogBatchSchema = z.object({
  plays: z
    .array(
      z.object({
        id: z.string().trim().min(8).max(64),
        mediaId: id,
        playlistId: id.nullable().optional(),
        startedAt: z.string().datetime(),
        durationSeconds: z.number().int().min(0).max(24 * 60 * 60)
      })
    )
    .min(1)
    .max(500)
});

export const screenCommandCreateSchema = z
  .object({
    type: screenCommandType,
    payload: metadata
  })
  .superRefine((value, context) => {
    if (value.type !== "remote_key") {
      if (value.type === "start_screen_mirror" || value.type === "stop_screen_mirror") {
        const result = z.object({ sessionId: id }).safeParse(value.payload);

        if (!result.success) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Informe a sessão de espelhamento no payload.",
            path: ["payload", "sessionId"]
          });
        }
      }

      return;
    }

    const result = z.object({ key: remoteControlKey }).safeParse(value.payload);

    if (!result.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe uma tecla válida no payload do controle remoto.",
        path: ["payload", "key"]
      });
    }
  });

export const screenMirrorSessionUpdateSchema = z
  .object({
    status: screenMirrorSessionStatus.optional(),
    offer: rtcSessionDescription.nullable().optional(),
    answer: rtcSessionDescription.nullable().optional(),
    errorMessage: z.string().trim().min(1).max(500).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe pelo menos um campo." });

export const screenMirrorCandidateCreateSchema = z.object({
  peer: screenMirrorPeer,
  candidate: rtcIceCandidate
});

export const screenCommandAckSchema = z.object({
  commandId: id,
  status: z.enum(["acknowledged", "failed"]).default("acknowledged"),
  errorMessage: z.string().trim().min(1).max(500).nullable().optional()
});

/* ---------- Contas, empresas e usuários ---------- */

export const footerConfigSchema = z.object({
  logoUrl: z.string().url().nullable().optional().default(null),
  background: color.default("#111827"),
  color: color.default("#ffffff"),
  phrase: z.string().trim().max(300).default(""),
  showPhrase: z.boolean().default(true),
  showDate: z.boolean().default(true),
  showTime: z.boolean().default(true),
  showWeather: z.boolean().default(true),
  showIcons: z.boolean().default(true),
  rssUrl: z.string().url().nullable().optional().default(null),
  speed: z.enum(["slow", "normal", "fast"]).default("normal")
});

export const accountUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    logoUrl: z.string().url().nullable(),
    loginImageUrl: z.string().url().nullable(),
    splashUrl: z.string().url().nullable(),
    splashEnabled: z.boolean(),
    primaryColor: color.nullable(),
    apkUrl: z.string().url().nullable(),
    footer: footerConfigSchema
  })
  .partial();

export const accountCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  kind: z.enum(["reseller", "client"]).default("client"),
  maxScreens: z.number().int().positive().max(100_000).nullable().optional(),
  maxInstagram: z.number().int().min(0).max(100).optional(),
  admin: z.object({
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().email().toLowerCase(),
    password: passwordSchema
  })
});

export const accountAdminUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    isActive: z.boolean(),
    maxScreens: z.number().int().positive().max(100_000).nullable(),
    maxInstagram: z.number().int().min(0).max(100)
  })
  .partial();

export const accountSwitchSchema = z.object({ accountId: id.nullable() });

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  document: shortText(30),
  contact: shortText(120),
  phone: shortText(30)
});

export const companyUpdateSchema = companyCreateSchema.partial();

export const userCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().toLowerCase(),
  password: passwordSchema,
  role: z.enum(["admin", "operator"]).default("operator"),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: timezone.nullable().optional(),
  restrictContent: z.boolean().default(false),
  screenIds: z.array(id).max(1000).default([])
});

export const userUpdateSchema = userCreateSchema
  .omit({ password: true })
  .partial()
  .extend({ password: passwordSchema.optional(), isActive: z.boolean().optional() });

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: timezone.nullable().optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: passwordSchema.optional()
});

export const rssSourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().url()
});

export const reportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mediaId: id.optional(),
  playlistId: id.optional(),
  screenId: id.optional(),
  companyId: id.optional()
});
