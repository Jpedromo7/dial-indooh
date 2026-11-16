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
