"use client";

import { ApiClientError, apiClient } from "@/lib/api-client";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export interface UploadedFile {
  url: string;
  mimeType: string;
  sizeBytes: number;
}

/** Envia um arquivo direto para o bucket (URL assinada) e devolve a URL pública. */
export async function uploadFile(file: File, onProgress?: (percent: number) => void): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiClientError("O tamanho máximo de arquivo é 500 MB.", 413, "file_too_large");
  }

  const mimeType = file.type || "application/octet-stream";
  const target = await apiClient.createMediaUploadUrl({ fileName: file.name, mimeType, sizeBytes: file.size });

  if (target.provider === "supabase") {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new ApiClientError("A configuração pública do Supabase está ausente.", 500, "supabase_public_config_missing");
    }

    const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await client.storage.from(target.bucket).uploadToSignedUrl(target.path, target.token, file, { contentType: mimeType });

    if (error) {
      throw new ApiClientError(error.message, 502, "storage_upload_failed");
    }

    onProgress?.(100);
    return { url: target.publicUrl, mimeType, sizeBytes: file.size };
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.signedUrl);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiClientError("Não foi possível enviar o arquivo ao armazenamento.", 502, "storage_upload_failed"));
    xhr.onerror = () => reject(new ApiClientError("Falha de rede ao enviar o arquivo.", 502, "storage_upload_failed"));
    xhr.send(file);
  });

  return { url: target.publicUrl, mimeType, sizeBytes: file.size };
}

/** Lê a duração de um vídeo no navegador (em segundos, arredondado para cima). */
export function readVideoDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? Math.max(1, Math.ceil(video.duration)) : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

/** Gera uma miniatura JPEG (quadro inicial do vídeo ou imagem reduzida). */
export async function createThumbnail(file: File): Promise<File | null> {
  try {
    const url = URL.createObjectURL(file);
    const source = await new Promise<HTMLImageElement | HTMLVideoElement>((resolve, reject) => {
      if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.muted = true;
        video.preload = "auto";
        video.onloadeddata = () => {
          video.currentTime = Math.min(1, (video.duration || 2) / 2);
        };
        video.onseeked = () => resolve(video);
        video.onerror = reject;
        video.src = url;
      } else {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      }
    });

    const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
    const scale = Math.min(1, 480 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-thumb.jpg`, { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
