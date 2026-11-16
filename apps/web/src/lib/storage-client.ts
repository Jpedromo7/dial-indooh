"use client";

import { createClient } from "@supabase/supabase-js";
import { ApiClientError } from "@/lib/api-client";

interface SignedUploadTarget {
  provider?: "supabase" | "r2" | "demo";
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}

let browserClient: ReturnType<typeof createClient> | null = null;

export async function uploadFileToStorage(file: File, target: SignedUploadTarget) {
  if (target.provider === "demo" || target.token === "demo-token") {
    return;
  }

  if (target.provider === "r2") {
    const response = await fetch(target.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!response.ok) {
      throw new ApiClientError("Não foi possível enviar o arquivo ao Cloudflare R2.", 502, "storage_upload_failed");
    }

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
    throw new ApiClientError("A configuração pública do Supabase está ausente.", 500, "supabase_public_config_missing");
  }

  browserClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return browserClient;
}
