import { z } from "zod";

const id = z.string().min(1, "O ID obrigatório está ausente.");
const optionalText = z.string().trim().min(1).max(500).nullable().optional();
const optionalDateTime = z.string().datetime().nullable().optional();
const metadata = z.record(z.unknown()).nullable().optional();
const screenOrientation = z.enum(["landscape", "portrait"]);
const mediaRotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const playbackState = z.enum(["idle", "playing", "paused", "transitioning", "error"]);
const remoteControlKey = z.enum(["up", "down", "left", "right", "select", "back"]);
const screenMirrorSessionStatus = z.enum(["requested", "connecting", "active", "ended", "failed"]);
const screenMirrorPeer = z.enum(["screen", "viewer"]);
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

export const idParamsSchema = z.object({
  id
});

export const screenMirrorSessionParamsSchema = z.object({
  id,
  sessionId: id
});

export const mediaIdParamsSchema = z.object({
  id
});

export const playlistItemParamsSchema = z.object({
  id,
  itemId: id
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(200)
});

export const mediaCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.enum(["image", "video"]),
  fileUrl: z.string().trim().url(),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  orientation: z.enum(["auto", "landscape", "portrait", "square"]).optional(),
  rotationDegrees: mediaRotation.optional()
});

export const mediaUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    orientation: z.enum(["auto", "landscape", "portrait", "square"]).optional(),
    rotationDegrees: mediaRotation.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe pelo menos um campo."
  });

export const mediaUploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive()
});

export const playlistCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: optionalText,
  isActive: z.boolean().optional(),
  scheduledStartAt: optionalDateTime,
  scheduledEndAt: optionalDateTime
});

export const playlistUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: optionalText,
    isActive: z.boolean().optional(),
    scheduledStartAt: optionalDateTime,
    scheduledEndAt: optionalDateTime
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe pelo menos um campo."
  });

export const playlistItemCreateSchema = z.object({
  mediaId: id,
  order: z.number().int().positive().optional(),
  displayDurationSeconds: z.number().int().positive().nullable().optional()
});

export const playlistItemUpdateSchema = z.object({
  displayDurationSeconds: z.number().int().positive().nullable()
});

export const playlistItemsReorderSchema = z.object({
  items: z
    .array(
      z.object({
        id,
        order: z.number().int().positive()
      })
    )
    .min(1)
});

export const screenCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: slug.optional(),
  location: optionalText,
  orientation: screenOrientation.optional()
});

export const screenUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    slug: slug.optional(),
    location: optionalText,
    orientation: screenOrientation.optional(),
    status: z.enum(["online", "offline"]).optional(),
    playlistId: id.nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe pelo menos um campo."
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
  sentAt: z.string().datetime().optional()
});

export const screenEventSchema = z.object({
  level: z.enum(["info", "warn", "error"]).default("info"),
  type: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  mediaId: id.nullable().optional(),
  metadata
});

export const screenCommandCreateSchema = z.object({
  type: screenCommandType,
  payload: metadata
}).superRefine((value, context) => {
  if (value.type !== "remote_key") {
    if (value.type === "start_screen_mirror" || value.type === "stop_screen_mirror") {
      const result = z
        .object({
          sessionId: id
        })
        .safeParse(value.payload);

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

  const result = z
    .object({
      key: remoteControlKey
    })
    .safeParse(value.payload);

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
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe pelo menos um campo."
  });

export const screenMirrorCandidateCreateSchema = z.object({
  peer: screenMirrorPeer,
  candidate: rtcIceCandidate
});

export const screenCommandAckSchema = z.object({
  commandId: id,
  status: z.enum(["acknowledged", "failed"]).default("acknowledged"),
  errorMessage: z.string().trim().min(1).max(500).nullable().optional()
});
