"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { MediaDto, MediaOrientation, MediaRotation, MediaStatus, MediaType } from "@dialindooh/shared";
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
  const [rotationDegrees, setRotationDegrees] = useState<MediaRotation>(0);
  const [detectedOrientation, setDetectedOrientation] = useState<MediaOrientation | null>(null);
  const [durationDetectionStatus, setDurationDetectionStatus] = useState<"idle" | "detecting" | "detected" | "failed">(
    "idle"
  );
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [updatingMediaId, setUpdatingMediaId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaDto | null>(null);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(() => new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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
  const selectedMedia = useMemo(() => media.filter((item) => selectedMediaIds.has(item.id)), [media, selectedMediaIds]);
  const allFilteredSelected =
    filteredMedia.length > 0 && filteredMedia.every((item) => selectedMediaIds.has(item.id));

  useEffect(() => {
    setDurationSeconds("");
    setDetectedOrientation(null);
    setRotationDegrees(0);

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

  useEffect(() => {
    setSelectedMediaIds((current) => {
      const availableIds = new Set(media.map((item) => item.id));
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [media]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      toast({ title: "Escolha um arquivo", description: "Selecione uma imagem ou vídeo antes de enviar.", variant: "error" });
      return;
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ title: "Arquivo não suportado", description: "Envie um arquivo de imagem ou vídeo.", variant: "error" });
      return;
    }

    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    setIsUploading(true);
    setProgress(8);

    try {
      const resolvedDurationSeconds = mediaType === "video" ? Number(durationSeconds) : null;

      if (mediaType === "video" && durationDetectionStatus === "detecting") {
        throw new Error("Aguarde a detecção da duração do vídeo.");
      }

      if (
        mediaType === "video" &&
        (resolvedDurationSeconds === null || !Number.isFinite(resolvedDurationSeconds) || resolvedDurationSeconds <= 0)
      ) {
        throw new Error("Não foi possível detectar a duração do vídeo. Informe a duração em segundos.");
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
        orientation: orientation === "auto" ? detectedOrientation ?? "auto" : orientation,
        rotationDegrees
      });
      setProgress(100);
      toast({ title: "Mídia enviada", description: "O arquivo já pode ser usado em playlists.", variant: "success" });
      setFile(null);
      setTitle("");
      setDurationSeconds("");
      setOrientation("auto");
      setRotationDegrees(0);
      setDetectedOrientation(null);
      setProgress(0);
      await query.refresh();
    } catch (error) {
      toast({ title: "Falha no envio", description: getApiErrorMessage(error), variant: "error" });
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
      toast({ title: "Mídia apagada", description: deleteTarget.title, variant: "success" });
      setSelectedMediaIds((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
      await query.refresh();
    } catch (error) {
      toast({ title: "Falha ao apagar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function updateMedia(item: MediaDto, patch: { orientation?: MediaOrientation; rotationDegrees?: MediaRotation }) {
    if (
      (patch.orientation === undefined || item.orientation === patch.orientation) &&
      (patch.rotationDegrees === undefined || item.rotationDegrees === patch.rotationDegrees)
    ) {
      return;
    }

    setUpdatingMediaId(item.id);

    try {
      await apiClient.updateMedia(item.id, patch);
      toast({
        title: "Mídia atualizada",
        description:
          patch.rotationDegrees !== undefined
            ? `${item.title}: ${rotationLabels[patch.rotationDegrees]}`
            : `${item.title}: ${orientationLabels[patch.orientation ?? item.orientation]}`,
        variant: "success"
      });
      await query.refresh();
    } catch (error) {
      toast({ title: "Falha ao atualizar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setUpdatingMediaId(null);
    }
  }

  async function updateMediaOrientation(item: MediaDto, nextOrientation: MediaOrientation) {
    if (item.orientation === nextOrientation) {
      return;
    }

    await updateMedia(item, { orientation: nextOrientation });
  }

  async function updateMediaRotation(item: MediaDto, nextRotation: MediaRotation) {
    if (item.rotationDegrees === nextRotation) {
      return;
    }

    await updateMedia(item, { rotationDegrees: nextRotation });
  }

  function toggleMediaSelection(id: string) {
    setSelectedMediaIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleFilteredSelection() {
    setSelectedMediaIds((current) => {
      const next = new Set(current);

      if (allFilteredSelected) {
        filteredMedia.forEach((item) => next.delete(item.id));
      } else {
        filteredMedia.forEach((item) => next.add(item.id));
      }

      return next;
    });
  }

  async function confirmBulkDelete() {
    const targets = selectedMedia;

    if (targets.length === 0) {
      setIsBulkDeleteOpen(false);
      return;
    }

    setIsBulkDeleting(true);

    try {
      const results = await Promise.allSettled(targets.map((item) => apiClient.deleteMedia(item.id)));
      const failedIds = new Set<string>();
      const failedMessages: string[] = [];

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const failedItem = targets[index];
          if (failedItem) {
            failedIds.add(failedItem.id);
          }
          failedMessages.push(getApiErrorMessage(result.reason));
        }
      });

      const deletedCount = targets.length - failedIds.size;

      setSelectedMediaIds(failedIds);
      setIsBulkDeleteOpen(false);
      await query.refresh();

      if (failedIds.size > 0) {
        toast({
          title: deletedCount > 0 ? "Algumas mídias foram apagadas" : "Não foi possível apagar",
          description: failedMessages[0] ?? "Verifique se as mídias estão em uso em playlists.",
          variant: deletedCount > 0 ? "success" : "error"
        });
      } else {
        toast({ title: "Mídias apagadas", description: `${deletedCount} item(ns) removido(s).`, variant: "success" });
      }
    } finally {
      setIsBulkDeleting(false);
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Card className="h-fit bg-card/70">
          <CardHeader>
            <CardTitle>Adicionar mídia</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUpload}>
              <UploadDropzone file={file} onFileChange={setFile} />
              <label className="block space-y-2 text-sm font-medium">
                <span>Título</span>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  placeholder={file?.name ?? "Campanha principal"}
                  value={title}
                />
              </label>
              {file?.type.startsWith("video/") ? (
                <label className="block space-y-2 text-sm font-medium">
                  <span>Duração do vídeo em segundos</span>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring read-only:text-muted-foreground"
                    disabled={durationDetectionStatus === "detecting"}
                    min={1}
                    onChange={(event) => setDurationSeconds(event.currentTarget.value)}
                    placeholder={durationDetectionStatus === "detecting" ? "Detectando..." : "Segundos"}
                    readOnly={durationDetectionStatus === "detected"}
                    type="number"
                    value={durationSeconds}
                  />
                  <p className="text-xs text-muted-foreground">
                    {durationDetectionStatus === "detecting"
                      ? "Lendo os metadados do vídeo automaticamente..."
                      : durationDetectionStatus === "detected"
                        ? `Detectado automaticamente: ${durationSeconds} segundos.`
                        : "Se a detecção falhar, informe a duração manualmente."}
                  </p>
                </label>
              ) : null}
              {file ? (
                <div className="grid gap-4">
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
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Rotação manual</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      onChange={(event) => setRotationDegrees(Number(event.currentTarget.value) as MediaRotation)}
                      value={rotationDegrees}
                    >
                      <option value={0}>Normal</option>
                      <option value={90}>Girar 90° horário</option>
                      <option value={180}>Girar 180°</option>
                      <option value={270}>Girar 90° anti-horário</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Use isso quando o vídeo vier deitado do celular mesmo estando marcado como vertical.
                    </p>
                  </label>
                </div>
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
                {isUploading ? "Enviando..." : "Criar mídia"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Os arquivos são enviados ao Supabase Storage e publicados para reprodução nas TVs Android.
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
                placeholder="Buscar mídia"
                value={search}
              />
            </label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setType(event.currentTarget.value as "all" | "image" | "video")}
              value={type}
            >
              <option value="all">Todos os tipos</option>
              <option value="image">Imagens</option>
              <option value="video">Vídeos</option>
            </select>
            {selectedMedia.length > 0 ? (
              <Button onClick={() => setIsBulkDeleteOpen(true)} type="button" variant="destructive">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Apagar {selectedMedia.length}
              </Button>
            ) : null}
          </div>

          {query.isLoading ? (
            <LoadingSkeleton className="h-96" />
          ) : filteredMedia.length === 0 ? (
            <EmptyState icon={FileVideo} title="Nenhuma mídia encontrada" description="Envie sua primeira imagem ou vídeo." />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card/70">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        aria-label="Selecionar mídias filtradas"
                        checked={allFilteredSelected}
                        className="h-4 w-4 rounded border bg-background"
                        onChange={toggleFilteredSelection}
                        type="checkbox"
                      />
                    </th>
                    <th className="px-4 py-3">Título</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Orientação</th>
                    <th className="px-4 py-3">Rotação</th>
                    <th className="px-4 py-3">MIME</th>
                    <th className="px-4 py-3">Tamanho</th>
                    <th className="px-4 py-3">Duração</th>
                    <th className="px-4 py-3">Criada em</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMedia.map((item) => (
                    <tr className="hover:bg-white/[0.03]" key={item.id}>
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Selecionar ${item.title}`}
                          checked={selectedMediaIds.has(item.id)}
                          className="h-4 w-4 rounded border bg-background"
                          onChange={() => toggleMediaSelection(item.id)}
                          type="checkbox"
                        />
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 font-medium">{item.title}</td>
                      <td className="px-4 py-3">{mediaTypeLabels[item.type]}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                          {mediaStatusLabels[item.status]}
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
                      <td className="px-4 py-3">
                        <select
                          className="h-9 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                          disabled={updatingMediaId === item.id}
                          onChange={(event) => updateMediaRotation(item, Number(event.currentTarget.value) as MediaRotation)}
                          value={item.rotationDegrees}
                        >
                          <option value={0}>Normal</option>
                          <option value={90}>90° horário</option>
                          <option value={180}>180°</option>
                          <option value={270}>90° anti-horário</option>
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
        title="Apagar mídia?"
        description="Essa ação não pode ser desfeita. Mídias em uso em playlists não podem ser apagadas."
        confirmLabel="Apagar"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <ConfirmDialog
        open={isBulkDeleteOpen}
        title="Apagar mídias selecionadas?"
        description={`${selectedMedia.length} item(ns) serão apagados. Mídias usadas em playlists serão mantidas.`}
        confirmLabel="Apagar selecionadas"
        isLoading={isBulkDeleting}
        onCancel={() => setIsBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
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

const mediaTypeLabels: Record<MediaType, string> = {
  image: "Imagem",
  video: "Vídeo"
};

const mediaStatusLabels: Record<MediaStatus, string> = {
  pending: "Pendente",
  processing: "Processando",
  ready: "Pronta",
  failed: "Falhou"
};

const rotationLabels: Record<MediaRotation, string> = {
  0: "Rotação normal",
  90: "Rotação 90° horário",
  180: "Rotação 180°",
  270: "Rotação 90° anti-horário"
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
