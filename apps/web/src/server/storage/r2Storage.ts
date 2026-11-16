import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "@/server/http";
import type { MediaUploadUrl } from "@/server/storage/supabaseStorage";

const DEFAULT_BUCKET = "dial-indooh-media";
const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 15 * 60;
const SUPPORTED_MIME_PREFIXES = ["image/", "video/"] as const;

interface UploadUrlInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export async function createR2MediaUploadUrl(input: UploadUrlInput): Promise<MediaUploadUrl> {
  validateUploadInput(input);

  const bucket = process.env.MEDIA_STORAGE_BUCKET || DEFAULT_BUCKET;
  const path = createStoragePath(input.fileName);
  const signedUrl = await getSignedUrl(
    createR2Client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      ContentType: input.mimeType || "application/octet-stream",
      ContentLength: input.sizeBytes
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS }
  );

  return {
    provider: "r2",
    bucket,
    path,
    token: "",
    signedUrl,
    publicUrl: `${getPublicBaseUrl()}/${encodeObjectPath(path)}`
  };
}

function createR2Client() {
  const accountId = requireEnvironmentVariable("R2_ACCOUNT_ID");
  const accessKeyId = requireEnvironmentVariable("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnvironmentVariable("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });
}

function validateUploadInput(input: UploadUrlInput) {
  if (!SUPPORTED_MIME_PREFIXES.some((prefix) => input.mimeType.startsWith(prefix))) {
    throw new ApiError(422, "unsupported_media_type", "Apenas uploads de imagem e vídeo são suportados.");
  }

  if (input.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new ApiError(413, "file_too_large", "O tamanho máximo de upload é 500 MB.");
  }
}

function createStoragePath(fileName: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
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
  const safeExtension = extension.toLowerCase().replace(/[^.a-z0-9]/g, "");

  return `uploads/${year}/${month}/${crypto.randomUUID()}-${safeBaseName}${safeExtension}`;
}

function getPublicBaseUrl() {
  const value = requireEnvironmentVariable("MEDIA_STORAGE_PUBLIC_URL").replace(/\/+$/, "");

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new ApiError(
      500,
      "r2_public_url_invalid",
      "MEDIA_STORAGE_PUBLIC_URL precisa ser uma URL HTTPS pública do bucket R2."
    );
  }

  return value;
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ApiError(500, "r2_config_missing", `${name} precisa estar configurado para usar o Cloudflare R2.`);
  }

  return value;
}

function encodeObjectPath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
