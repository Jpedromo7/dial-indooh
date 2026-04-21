import { z } from "zod";

const id = z.string().min(1, "Required id is missing.");
const optionalText = z.string().trim().min(1).max(500).nullable().optional();
const optionalDateTime = z.string().datetime().nullable().optional();
const metadata = z.record(z.unknown()).nullable().optional();
const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");

export const idParamsSchema = z.object({
  id
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
  orientation: z.enum(["auto", "landscape", "portrait", "square"]).optional()
});

export const mediaUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    orientation: z.enum(["auto", "landscape", "portrait", "square"]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
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
    message: "At least one field must be provided."
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
  location: optionalText
});

export const screenUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    slug: slug.optional(),
    location: optionalText,
    status: z.enum(["online", "offline"]).optional(),
    playlistId: id.nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided."
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
  type: z.enum(["refresh_playlist", "clear_cache", "restart_player", "reload_app"]),
  payload: metadata
});

export const screenCommandAckSchema = z.object({
  commandId: id,
  status: z.enum(["acknowledged", "failed"]).default("acknowledged"),
  errorMessage: z.string().trim().min(1).max(500).nullable().optional()
});
