import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "@/server/http";

const DEFAULT_BUCKET = "dial-indooh-media";
const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;
const SUPPORTED_MIME_PREFIXES = ["image/", "video/"] as const;

interface UploadUrlInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MediaUploadUrl {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
}

export async function createMediaUploadUrl(input: UploadUrlInput): Promise<MediaUploadUrl> {
  validateUploadInput(input);

  const bucket = getMediaBucket();
  const client = createSupabaseAdminClient();
  const path = createStoragePath(input.fileName);

  await ensurePublicBucket(client, bucket);

  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path, {
    upsert: false
  });

  if (error || !data) {
    throw new ApiError(502, "storage_signed_url_failed", error?.message ?? "Could not create upload URL.");
  }

  return {
    bucket,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: getPublicMediaUrl(client, bucket, path)
  };
}

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new ApiError(500, "supabase_url_missing", "NEXT_PUBLIC_SUPABASE_URL must be configured.");
  }

  if (!serviceRoleKey) {
    throw new ApiError(500, "supabase_service_role_missing", "SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function ensurePublicBucket(client: ReturnType<typeof createSupabaseAdminClient>, bucket: string) {
  const { data } = await client.storage.getBucket(bucket);

  if (data) {
    if (!data.public) {
      const { error } = await client.storage.updateBucket(bucket, { public: true });

      if (error) {
        throw new ApiError(502, "storage_bucket_update_failed", error.message);
      }
    }

    return;
  }

  const { error } = await client.storage.createBucket(bucket, {
    public: true
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new ApiError(502, "storage_bucket_create_failed", error.message);
  }
}

function validateUploadInput(input: UploadUrlInput) {
  if (!SUPPORTED_MIME_PREFIXES.some((prefix) => input.mimeType.startsWith(prefix))) {
    throw new ApiError(422, "unsupported_media_type", "Only image and video uploads are supported.");
  }

  if (input.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new ApiError(413, "file_too_large", "The maximum upload size is 500 MB.");
  }
}

function createStoragePath(fileName: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeName = sanitizeFileName(fileName);

  return `uploads/${year}/${month}/${crypto.randomUUID()}-${safeName}`;
}

function sanitizeFileName(fileName: string) {
  const extension = fileName.includes(".") ? `.${fileName.split(".").pop()}` : "";
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const safeBaseName =
    baseName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "media";

  return `${safeBaseName}${extension.toLowerCase().replace(/[^.a-z0-9]/g, "")}`;
}

function getMediaBucket() {
  return process.env.MEDIA_STORAGE_BUCKET || DEFAULT_BUCKET;
}

function getPublicMediaUrl(client: ReturnType<typeof createSupabaseAdminClient>, bucket: string, path: string) {
  const configuredBaseUrl = process.env.MEDIA_STORAGE_PUBLIC_URL?.replace(/\/+$/, "");

  if (configuredBaseUrl) {
    return `${configuredBaseUrl}/${path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
