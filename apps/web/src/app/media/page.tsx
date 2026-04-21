"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { MediaDto, MediaOrientation } from "@dialindooh/shared";
import { FileVideo, ImagePlus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { UploadDropzone } from "@/components/admin/upload-dropzone";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { uploadFileToSupabaseStorage } from "@/lib/storage-client";

export default function MediaPage() {
  const { toast } = useToast();
  const query = useApiQuery(apiClient.listMedia, []);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "image" | "video">("all");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [orientation, setOrientation] = useState<MediaOrientation>("auto");
  const [detectedOrientation, setDetectedOrientation] = useState<MediaOrientation | null>(null);
  const [durationDetectionStatus, setDurationDetectionStatus] = useState<"idle" | "detecting" | "detected" | "failed">(
    "idle"
  );
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [updatingMediaId, setUpdatingMediaId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaDto | null>(null);

  const media = query.data ?? [];
  const filteredMedia = useMemo(
    () =>
      media.filter((item) => {
        const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase());
        const matchesType = type === "all" || item.type === type;
        return matchesSearch && matchesType;
      }),
    [media, search, type]
  );

  useEffect(() => {
    setDurationSeconds("");
    setDetectedOrientation(null);

    if (!file?.type.startsWith("video/")) {
      setDurationDetectionStatus("idle");
    } else {
      setDurationDetectionStatus("detecting");
    }

    if (!file?.type.startsWith("image/") && !file?.type.startsWith("video/")) {
      return undefined;
    }

    let isActive = true;

    readMediaMetadata(file).then((metadata) => {
      if (!isActive) {
        return;
      }

      setDetectedOrientation(metadata.orientation);

      if (file.type.startsWith("video/")) {
        if (metadata.durationSeconds) {
          setDurationSeconds(String(metadata.durationSeconds));
          setDurationDetectionStatus("detected");
        } else {
          setDurationDetectionStatus("failed");
        }
      }
    });

    return () => {
      isActive = false;
    };
  }, [file]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      toast({ title: "Choose a file", description: "Select an image or video before uploading.", variant: "error" });
      return;
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ title: "Unsupported file", description: "Upload an image or video file.", variant: "error" });
      return;
    }

    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    setIsUploading(true);
    setProgress(8);

    try {
      const resolvedDurationSeconds = mediaType === "video" ? Number(durationSeconds) : null;

      if (mediaType === "video" && durationDetectionStatus === "detecting") {
        throw new Error("Wait until the video duration is detected.");
      }

      if (
        mediaType === "video" &&
        (resolvedDurationSeconds === null || !Number.isFinite(resolvedDurationSeconds) || resolvedDurationSeconds <= 0)
      ) {
        throw new Error("The video duration could not be detected. Enter the duration in seconds.");
      }

      setProgress(18);
      const uploadTarget = await apiClient.createMediaUploadUrl({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      });

      setProgress(42);
      await uploadFileToSupabaseStorage(file, uploadTarget);
      setProgress(82);

      await apiClient.createMedia({
        title: title.trim() || file.name,
        type: mediaType,
        fileUrl: uploadTarget.publicUrl,
        mimeType: file.type,
        sizeBytes: file.size,
        durationSeconds: resolvedDurationSeconds,
        orientation: orientation === "auto" ? detectedOrientation ?? "auto" : orientation
      });
      setProgress(100);
      toast({ title: "Media uploaded", description: "The file is ready to be used in playlists.", variant: "success" });
      setFile(null);
      setTitle("");
      setDurationSeconds("");
      setOrientation("auto");
      setDetectedOrientation(null);
      setProgress(0);
      await query.refresh();
    } catch (error) {
      toast({ title: "Upload failed", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      await apiClient.deleteMedia(deleteTarget.id);
      toast({ title: "Media deleted", description: deleteTarget.title, variant: "success" });
      setDeleteTarget(null);
      await query.refresh();
    } catch (error) {
      toast({ title: "Delete failed", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function updateMediaOrientation(item: MediaDto, nextOrientation: MediaOrientation) {
    if (item.orientation === nextOrientation) {
      return;
    }

    setUpdatingMediaId(item.id);

    try {
      await apiClient.updateMedia(item.id, { orientation: nextOrientation });
      toast({
        title: "Orientação atualizada",
        description: `${item.title}: ${orientationLabels[nextOrientation]}`,
        variant: "success"
      });
      await query.refresh();
    } catch (error) {
      toast({ title: "Falha ao atualizar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setUpdatingMediaId(null);
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Card className="h-fit bg-card/70">
          <CardHeader>
            <CardTitle>Add media</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUpload}>
              <UploadDropzone file={file} onFileChange={setFile} />
              <label className="block space-y-2 text-sm font-medium">
                <span>Title</span>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  placeholder={file?.name ?? "Campaign hero"}
                  value={title}
                />
              </label>
              {file?.type.startsWith("video/") ? (
                <label className="block space-y-2 text-sm font-medium">
                  <span>Video duration seconds</span>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring read-only:text-muted-foreground"
                    disabled={durationDetectionStatus === "detecting"}
                    min={1}
                    onChange={(event) => setDurationSeconds(event.currentTarget.value)}
                    placeholder={durationDetectionStatus === "detecting" ? "Detecting..." : "Seconds"}
                    readOnly={durationDetectionStatus === "detected"}
                    type="number"
                    value={durationSeconds}
                  />
                  <p className="text-xs text-muted-foreground">
                    {durationDetectionStatus === "detecting"
                      ? "Reading video metadata automatically..."
                      : durationDetectionStatus === "detected"
                        ? `Detected automatically: ${durationSeconds} seconds.`
                        : "If detection fails, enter the duration manually."}
                  </p>
                </label>
              ) : null}
              {file ? (
                <label className="block space-y-2 text-sm font-medium">
                  <span>Orientação da mídia</span>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    onChange={(event) => setOrientation(event.currentTarget.value as MediaOrientation)}
                    value={orientation}
                  >
                    <option value="auto">Automática{detectedOrientation ? ` (${orientationLabels[detectedOrientation]})` : ""}</option>
                    <option value="landscape">Horizontal</option>
                    <option value="portrait">Vertical</option>
                    <option value="square">Quadrada</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Use Vertical para vídeos ou imagens 9:16. A TV exibirá centralizado sem distorcer.
                  </p>
                </label>
              ) : null}
              {isUploading ? (
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              ) : null}
              <Button
                className="w-full"
                disabled={isUploading || durationDetectionStatus === "detecting"}
                type="submit"
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {isUploading ? "Uploading..." : "Create media"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Files are uploaded to Supabase Storage and published for Android TV playback.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {query.error ? <ErrorBanner message={query.error} /> : null}
          <div className="flex flex-col gap-3 rounded-lg border bg-card/70 p-4 md:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search media"
                value={search}
              />
            </label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setType(event.currentTarget.value as "all" | "image" | "video")}
              value={type}
            >
              <option value="all">All types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </select>
          </div>

          {query.isLoading ? (
            <LoadingSkeleton className="h-96" />
          ) : filteredMedia.length === 0 ? (
            <EmptyState icon={FileVideo} title="No media found" description="Upload your first image or video asset." />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card/70">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Orientation</th>
                    <th className="px-4 py-3">MIME</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMedia.map((item) => (
                    <tr className="hover:bg-white/[0.03]" key={item.id}>
                      <td className="max-w-xs truncate px-4 py-3 font-medium">{item.title}</td>
                      <td className="px-4 py-3 capitalize">{item.type}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border px-2.5 py-1 text-xs font-semibold capitalize">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="h-9 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                          disabled={updatingMediaId === item.id}
                          onChange={(event) => updateMediaOrientation(item, event.currentTarget.value as MediaOrientation)}
                          value={item.orientation}
                        >
                          <option value="auto">Automática</option>
                          <option value="landscape">Horizontal</option>
                          <option value="portrait">Vertical</option>
                          <option value="square">Quadrada</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.mimeType}</td>
                      <td className="px-4 py-3">{formatBytes(item.sizeBytes)}</td>
                      <td className="px-4 py-3">{formatDuration(item.durationSeconds)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button onClick={() => setDeleteTarget(item)} size="icon" type="button" variant="ghost">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete media?"
        description="This cannot be undone. Media currently used in playlists cannot be deleted."
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}

const orientationLabels: Record<MediaOrientation, string> = {
  auto: "Automática",
  landscape: "Horizontal",
  portrait: "Vertical",
  square: "Quadrada"
};

function readMediaMetadata(file: File) {
  return file.type.startsWith("video/") ? readVideoMetadata(file) : readImageMetadata(file);
}

function readVideoMetadata(file: File) {
  return new Promise<{ durationSeconds: number | null; orientation: MediaOrientation }>((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        durationSeconds: Number.isFinite(video.duration) && video.duration > 0 ? Math.ceil(video.duration) : null,
        orientation: getOrientationFromDimensions(video.videoWidth, video.videoHeight)
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ durationSeconds: null, orientation: "auto" });
    };
    video.src = objectUrl;
  });
}

function readImageMetadata(file: File) {
  return new Promise<{ durationSeconds: null; orientation: MediaOrientation }>((resolve) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        durationSeconds: null,
        orientation: getOrientationFromDimensions(image.naturalWidth, image.naturalHeight)
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ durationSeconds: null, orientation: "auto" });
    };
    image.src = objectUrl;
  });
}

function getOrientationFromDimensions(width: number, height: number): MediaOrientation {
  if (!width || !height) {
    return "auto";
  }

  const ratio = width / height;

  if (ratio > 1.1) return "landscape";
  if (ratio < 0.9) return "portrait";
  return "square";
}
