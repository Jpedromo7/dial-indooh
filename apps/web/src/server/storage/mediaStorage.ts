import { ApiError } from "@/server/http";
import { createR2MediaUploadUrl } from "@/server/storage/r2Storage";
import { createMediaUploadUrl as createSupabaseMediaUploadUrl } from "@/server/storage/supabaseStorage";

interface UploadUrlInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export function createMediaUploadUrl(input: UploadUrlInput) {
  const provider = (process.env.MEDIA_STORAGE_PROVIDER || "supabase").trim().toLowerCase();

  if (provider === "r2") {
    return createR2MediaUploadUrl(input);
  }

  if (provider === "supabase") {
    return createSupabaseMediaUploadUrl(input);
  }

  throw new ApiError(500, "storage_provider_invalid", "MEDIA_STORAGE_PROVIDER deve ser 'supabase' ou 'r2'.");
}

/**
 * Garante que uma URL de arquivo aponta para o bucket de mídia da plataforma
 * (evita que as TVs baixem arquivos de domínios arbitrários).
 */
export function assertStorageUrl(url: string | null | undefined, field = "fileUrl") {
  if (!url) {
    return;
  }

  const prefixes = getAllowedStoragePrefixes();

  if (prefixes.length === 0) {
    return;
  }

  if (!prefixes.some((prefix) => url.startsWith(prefix))) {
    throw new ApiError(422, "invalid_storage_url", "O arquivo precisa ser enviado pelo painel.", { field });
  }
}

function getAllowedStoragePrefixes() {
  const values = [process.env.MEDIA_STORAGE_PUBLIC_URL, ...(process.env.MEDIA_ALLOWED_URL_PREFIXES ?? "").split(",")];

  return values
    .map((value) => value?.trim().replace(/\/+$/, ""))
    .filter((value): value is string => Boolean(value))
    .map((value) => `${value}/`);
}
