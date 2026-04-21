"use client";

import type { PlaylistDto, ScreenDto } from "@dialindooh/shared";
import { CalendarClock, MapPin, MonitorPlay } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

interface ScreenCardProps {
  screen: ScreenDto;
  playlists: PlaylistDto[];
  onSelect: (screen: ScreenDto) => void;
  onAssign: (screenId: string, playlistId: string) => void;
}

export function ScreenCard({ screen, playlists, onSelect, onAssign }: ScreenCardProps) {
  return (
    <div className="rounded-lg border bg-card/70 p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MonitorPlay className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold">{screen.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{screen.slug}</p>
          </div>
        </div>
        <StatusBadge status={screen.status} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {screen.location ?? "No location"}
        </span>
        <span className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          Last seen {formatDate(screen.lastSeenAt)}
        </span>
        <span className="flex items-center gap-2">
          <MonitorPlay className="h-4 w-4" aria-hidden="true" />
          {screen.orientation === "portrait" ? "Tela vertical" : "Tela horizontal"}
        </span>
      </div>
      <div className="mt-4 rounded-md bg-muted/40 p-3">
        <p className="text-xs uppercase text-muted-foreground">Activation code</p>
        <p className="mt-1 font-mono text-lg font-semibold tracking-normal">{screen.activationCode}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          onChange={(event) => onAssign(screen.id, event.currentTarget.value)}
          value={screen.activePlaylistId ?? ""}
        >
          <option value="">No playlist</option>
          {playlists.map((playlist) => (
            <option key={playlist.id} value={playlist.id}>
              {playlist.name}
            </option>
          ))}
        </select>
        <Button onClick={() => onSelect(screen)} type="button" variant="secondary">
          Details
        </Button>
      </div>
    </div>
  );
}
