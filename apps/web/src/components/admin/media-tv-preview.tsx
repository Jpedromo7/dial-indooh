"use client";

import { useEffect, useState } from "react";
import type { MediaDto, ScreenOrientation } from "@dialindooh/shared";
import { ImageIcon, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaTvPreviewProps {
  media: Pick<MediaDto, "fileUrl" | "mimeType" | "orientation" | "title" | "type">;
  screenOrientation: ScreenOrientation;
  className?: string;
}

export function MediaTvPreview({ media, screenOrientation, className }: MediaTvPreviewProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [media.fileUrl, media.type]);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-md border border-white/10 bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
          screenOrientation === "portrait" ? "aspect-[9/16] w-20" : "aspect-video w-32"
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
        {hasError ? (
          <PreviewFallback type={media.type} />
        ) : media.type === "image" ? (
          <img
            alt={`Prévia de ${media.title}`}
            className="relative z-10 h-full w-full object-contain"
            onError={() => setHasError(true)}
            src={media.fileUrl}
          />
        ) : (
          <>
            <video
              autoPlay
              className="relative z-10 h-full w-full object-contain"
              loop
              muted
              onError={() => setHasError(true)}
              playsInline
              preload="metadata"
              src={media.fileUrl}
            />
            <div className="pointer-events-none absolute bottom-1 right-1 z-20 rounded-full bg-black/65 p-1 text-white">
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">{getPreviewCaption(media.orientation, screenOrientation)}</p>
    </div>
  );
}

function PreviewFallback({ type }: { type: MediaDto["type"] }) {
  return (
    <div className="relative z-10 flex h-full w-full items-center justify-center text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-full border border-white/10 bg-white/5 p-2">
          {type === "video" ? <Play className="h-4 w-4" aria-hidden="true" /> : <ImageIcon className="h-4 w-4" aria-hidden="true" />}
        </div>
        <span className="text-[11px]">Prévia indisponível</span>
      </div>
    </div>
  );
}

function getPreviewCaption(orientation: MediaDto["orientation"], screenOrientation: ScreenOrientation) {
  if (orientation === "auto") {
    return "Encaixe automático na TV.";
  }

  if (orientation === "square") {
    return "Formato quadrado com margens equilibradas.";
  }

  if (orientation === screenOrientation) {
    return "Mesmo formato da tela, sem cortes.";
  }

  return screenOrientation === "landscape"
    ? "A TV vai mostrar barras laterais."
    : "A TV vai mostrar barras em cima e embaixo.";
}
