"use client";

import { useEffect, useState } from "react";
import type { MediaOrientation, PlaylistItemDto } from "@dialindooh/shared";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";

interface PlaylistItemRowProps {
  item: PlaylistItemDto;
  index: number;
  isSaving?: boolean;
  onDurationChange: (itemId: string, duration: number) => void;
  onRemove: (itemId: string) => void;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
}

export function PlaylistItemRow({
  item,
  index,
  isSaving = false,
  onDurationChange,
  onRemove,
  onDragStart,
  onDrop
}: PlaylistItemRowProps) {
  const isImage = item.media.type === "image";
  const [duration, setDuration] = useState(String(item.displayDurationSeconds ?? 10));

  useEffect(() => {
    setDuration(String(item.displayDurationSeconds ?? 10));
  }, [item.displayDurationSeconds]);

  return (
    <div
      className="grid gap-4 rounded-lg border bg-card/70 p-4 md:grid-cols-[auto_1fr_8rem_9rem_8rem_auto]"
      draggable
      onDragOver={(event) => event.preventDefault()}
      onDragStart={() => onDragStart(index)}
      onDrop={() => onDrop(index)}
    >
      <div className="flex items-center gap-3">
        <GripVertical className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-semibold">
          {item.order}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold">{item.media.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{item.media.mimeType}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-muted-foreground">Type</p>
        <p className="mt-1 text-sm font-medium capitalize">{item.media.type}</p>
      </div>
      <div>
        <p className="text-xs uppercase text-muted-foreground">Orientação</p>
        <p className="mt-1 w-fit rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
          {orientationLabels[item.media.orientation]}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase text-muted-foreground">{isImage ? "Display" : "Duration"}</p>
        {isImage ? (
          <input
            className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            min={1}
            onBlur={() => onDurationChange(item.id, Number(duration))}
            onChange={(event) => setDuration(event.currentTarget.value)}
            type="number"
            value={duration}
          />
        ) : (
          <p className="mt-1 text-sm font-medium">{formatDuration(item.media.durationSeconds)}</p>
        )}
      </div>
      <Button disabled={isSaving} onClick={() => onRemove(item.id)} size="icon" type="button" variant="ghost">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

const orientationLabels: Record<MediaOrientation, string> = {
  auto: "Automática",
  landscape: "Horizontal",
  portrait: "Vertical",
  square: "Quadrada"
};
