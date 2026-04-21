"use client";

import { createClient } from "@supabase/supabase-js";
import { ApiClientError } from "@/lib/api-client";

interface SignedUploadTarget {
  bucket: string;
  path: string;
  token: string;
}

let browserClient: ReturnType<typeof createClient> | null = null;

export async function uploadFileToSupabaseStorage(file: File, target: SignedUploadTarget) {
  if (target.token === "demo-token") {
    return;
  }

  const client = getSupabaseBrowserClient();
  const { error } = await client.storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file, {
    contentType: file.type || "application/octet-stream"
  });

  if (error) {
    throw new ApiClientError(error.message, 502, "storage_upload_failed");
  }
}

function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new ApiClientError("Supabase public configuration is missing.", 500, "supabase_public_config_missing");
  }

  browserClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return browserClient;
}
