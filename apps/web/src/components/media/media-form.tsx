"use client";

import { useEffect, useState } from "react";
import { Loader2, Monitor, Smartphone, UploadCloud, X } from "lucide-react";
import { extractYoutubeId, type MediaDto, type UrlConfig, type YoutubeConfig } from "@dialindooh/shared";
import { BaseMediaFields, baseFromMedia, basePayload, useMediaFormData, type BaseMediaState } from "@/components/media/media-base";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Modal, Switch } from "@/components/ui/form";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatBytes } from "@/lib/format";
import { createThumbnail, readVideoDuration, uploadFile } from "@/lib/storage-client";
import { cn } from "@/lib/utils";

export type MediaFormKind = "file" | "youtube" | "url";

interface FileSlotState {
  file: File | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  progress: number | null;
}

const emptySlot: FileSlotState = { file: null, url: null, mimeType: null, sizeBytes: null, progress: null };

export function MediaFormModal({
  open,
  kind,
  media,
  onClose,
  onSaved
}: {
  open: boolean;
  kind: MediaFormKind;
  media: MediaDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { companies, screens, screenIds } = useMediaFormData(open, media?.id ?? null);
  const [base, setBase] = useState<BaseMediaState>(() => baseFromMedia(media));
  const [horizontal, setHorizontal] = useState<FileSlotState>(emptySlot);
  const [vertical, setVertical] = useState<FileSlotState>(emptySlot);
  const [link, setLink] = useState("");
  const [reload, setReload] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBase(baseFromMedia(media, { durationSeconds: kind === "file" ? 10 : kind === "youtube" ? 60 : 30 }));
    setHorizontal(media?.fileUrl ? { ...emptySlot, url: media.fileUrl, mimeType: media.mimeType, sizeBytes: media.sizeBytes } : emptySlot);
    setVertical(media?.fileUrlVertical ? { ...emptySlot, url: media.fileUrlVertical, mimeType: media.mimeType } : emptySlot);
    setLink(((media?.config as YoutubeConfig | UrlConfig | null)?.url as string | undefined) ?? "");
    setReload(Boolean((media?.config as UrlConfig | null)?.reload));
  }, [kind, media, open]);

  useEffect(() => {
    if (screenIds) setBase((current) => ({ ...current, screenIds }));
  }, [screenIds]);

  const fileType = media?.type ?? (horizontal.mimeType ?? vertical.mimeType ?? "").split("/")[0];
  const isVideo = fileType === "video";
  const youtubeId = kind === "youtube" ? extractYoutubeId(link) : null;
  const orientationHint = kind === "file" ? (horizontal.url && !vertical.url ? "landscape" : vertical.url && !horizontal.url ? "portrait" : null) : null;

  async function pickFile(slot: "h" | "v", file: File | null) {
    if (!file) return;
    const setSlot = slot === "h" ? setHorizontal : setVertical;
    const other = slot === "h" ? vertical : horizontal;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ title: "Envie uma imagem ou um vídeo.", variant: "error" });
      return;
    }

    if (other.mimeType && other.mimeType.split("/")[0] !== file.type.split("/")[0]) {
      toast({ title: "As duas versões precisam ser do mesmo tipo (imagem ou vídeo).", variant: "error" });
      return;
    }

    if (!base.title) {
      setBase((current) => ({ ...current, title: file.name.replace(/\.[^.]+$/, "") }));
    }

    if (file.type.startsWith("video/")) {
      const duration = await readVideoDuration(file);
      if (duration) setBase((current) => ({ ...current, durationSeconds: duration }));
    }

    setSlot({ file, url: null, mimeType: file.type, sizeBytes: file.size, progress: 0 });

    try {
      const uploaded = await uploadFile(file, (progress) => setSlot((current) => ({ ...current, progress })));
      setSlot({ file, url: uploaded.url, mimeType: uploaded.mimeType, sizeBytes: uploaded.sizeBytes, progress: null });
    } catch (error) {
      setSlot(emptySlot);
      toast({ title: "Falha no envio", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function save() {
    if (!base.title.trim()) {
      toast({ title: "Informe o nome da mídia.", variant: "error" });
      return;
    }

    setIsSaving(true);

    try {
      if (kind === "file") {
        if (!horizontal.url && !vertical.url) {
          toast({ title: "Envie o arquivo horizontal ou vertical.", variant: "error" });
          return;
        }

        if (horizontal.progress !== null || vertical.progress !== null) {
          toast({ title: "Aguarde o envio terminar.", variant: "error" });
          return;
        }

        let thumbnailUrl = media?.thumbnailUrl ?? null;
        const sourceFile = horizontal.file ?? vertical.file;
        if (sourceFile) {
          const thumb = await createThumbnail(sourceFile);
          if (thumb) thumbnailUrl = (await uploadFile(thumb)).url;
        }

        const payload = {
          ...basePayload(base),
          durationSeconds: isVideo ? base.durationSeconds : base.durationSeconds ?? 10,
          fileUrl: horizontal.url,
          fileUrlVertical: vertical.url,
          mimeType: horizontal.mimeType ?? vertical.mimeType,
          sizeBytes: horizontal.sizeBytes ?? 0,
          sizeBytesVertical: vertical.sizeBytes,
          thumbnailUrl
        };

        if (media) {
          await apiClient.updateMedia(media.id, payload);
        } else {
          await apiClient.createMedia({ ...payload, type: isVideo ? "video" : "image" });
        }
      } else {
        if (kind === "youtube" && !youtubeId) {
          toast({ title: "Link do YouTube inválido.", variant: "error" });
          return;
        }

        const config = kind === "youtube" ? { url: link.trim() } : { url: link.trim(), reload };
        const payload = { ...basePayload(base), config };
        if (media) {
          await apiClient.updateMedia(media.id, payload);
        } else {
          await apiClient.createMedia({ ...payload, type: kind });
        }
      }

      toast({ title: media ? "Mídia atualizada" : "Mídia cadastrada", variant: "success" });
      onSaved();
      onClose();
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  const title = media ? `Editar — ${media.title}` : kind === "file" ? "Nova mídia: vídeo ou imagem" : kind === "youtube" ? "Novo link do YouTube" : "Novo link externo";

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button disabled={isSaving} onClick={() => void save()} type="button">
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      size="lg"
      title={title}
    >
      <div className="grid gap-5">
        {kind === "file" ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium">Arquivos</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FileSlot label="Horizontal" onPick={(file) => void pickFile("h", file)} onRemove={() => setHorizontal(emptySlot)} slot={horizontal} vertical={false} />
              <FileSlot label="Vertical" onPick={(file) => void pickFile("v", file)} onRemove={() => setVertical(emptySlot)} slot={vertical} vertical />
            </div>
            <p className="text-xs text-muted-foreground">
              Cada terminal toca a versão da sua orientação. Se só houver uma versão, ela é usada nas duas.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            <Field label={kind === "youtube" ? "Link do YouTube" : "Endereço da página (HTTPS)"} required>
              <Input onChange={(event) => setLink(event.target.value)} placeholder={kind === "youtube" ? "https://www.youtube.com/watch?v=..." : "https://..."} value={link} />
            </Field>
            {kind === "youtube" && youtubeId ? (
              <div className="aspect-video overflow-hidden rounded-lg border bg-black">
                <iframe
                  allow="autoplay; encrypted-media"
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                  title="Prévia do YouTube"
                />
              </div>
            ) : null}
            {kind === "youtube" ? (
              <p className="text-xs text-muted-foreground">Vídeos do YouTube só tocam com internet (não são baixados para a TV). Informe a duração que deve ficar na tela.</p>
            ) : (
              <Switch checked={reload} label="Recarregar a página a cada exibição" onChange={setReload} />
            )}
          </div>
        )}
        <BaseMediaFields
          companies={companies}
          durationHint={isVideo ? "Preenchida automaticamente pela duração do vídeo." : undefined}
          onChange={setBase}
          orientation={orientationHint}
          screens={screens}
          value={base}
        />
      </div>
    </Modal>
  );
}

function FileSlot({
  label,
  slot,
  vertical,
  onPick,
  onRemove
}: {
  label: string;
  slot: FileSlotState;
  vertical: boolean;
  onPick: (file: File | null) => void;
  onRemove: () => void;
}) {
  const preview = slot.file ? URL.createObjectURL(slot.file) : slot.url;
  const isVideo = (slot.mimeType ?? "").startsWith("video/");

  return (
    <div className="grid gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {vertical ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />} {label}
      </span>
      <label
        className={cn(
          "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/20 text-center transition hover:border-primary/60",
          vertical ? "aspect-[9/16] max-h-64" : "aspect-video"
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onPick(event.dataTransfer.files.item(0));
        }}
      >
        <input accept="image/*,video/*" className="sr-only" onChange={(event) => onPick(event.target.files?.item(0) ?? null)} type="file" />
        {preview ? (
          isVideo ? (
            <video className="h-full w-full object-contain" muted src={preview} />
          ) : (
            <img alt="" className="h-full w-full object-contain" src={preview} />
          )
        ) : (
          <span className="flex flex-col items-center gap-2 p-3 text-xs text-muted-foreground">
            <UploadCloud className="h-6 w-6 text-primary" />
            Clique ou arraste o arquivo
          </span>
        )}
        {slot.progress !== null ? (
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/70 px-2 py-1 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" /> Enviando {slot.progress}%
          </span>
        ) : slot.sizeBytes ? (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-0.5 text-[11px]">{formatBytes(slot.sizeBytes)}</span>
        ) : null}
      </label>
      {slot.url || slot.file ? (
        <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={onRemove} type="button">
          <X className="h-3 w-3" /> Remover {label.toLowerCase()}
        </button>
      ) : null}
    </div>
  );
}
