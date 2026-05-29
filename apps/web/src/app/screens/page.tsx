"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  RemoteControlKey,
  ScreenCommandDto,
  ScreenCommandStatus,
  ScreenCommandType,
  ScreenDetailDto,
  ScreenDto,
  ScreenEventLevel,
  ScreenOrientation
} from "@dialindooh/shared";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleDot,
  CornerDownLeft,
  MonitorPlay,
  MonitorUp,
  RotateCcw,
  Settings,
  Trash2,
  Tv,
  Wifi
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { ScreenCard } from "@/components/admin/screen-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

const SCREEN_STATUS_REFRESH_MS = 30 * 1000;
const SCREEN_DETAIL_REFRESH_MS = 8 * 1000;

export default function ScreensPage() {
  const { toast } = useToast();
  const screensQuery = useApiQuery(apiClient.listScreens, []);
  const playlistsQuery = useApiQuery(apiClient.listPlaylists, []);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [location, setLocation] = useState("");
  const [orientation, setOrientation] = useState<ScreenOrientation>("landscape");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<ScreenDto | null>(null);
  const [detail, setDetail] = useState<ScreenDetailDto | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScreenDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const screens = screensQuery.data ?? [];
  const playlists = playlistsQuery.data ?? [];

  useEffect(() => {
    const interval = setInterval(() => void screensQuery.refresh({ silent: true }), SCREEN_STATUS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [screensQuery.refresh]);

  useEffect(() => {
    if (!selectedScreen) {
      setDetail(null);
      return;
    }

    let active = true;
    const loadDetail = (silent = false) => {
      if (!silent) {
        setDetail(null);
      }
      setDetailError(null);
      return apiClient
        .getScreen(selectedScreen.id)
        .then((screen) => {
          if (active) {
            setDetail(screen);
          }
        })
        .catch((error) => {
          if (active) {
            setDetailError(getApiErrorMessage(error));
          }
        });
    };

    void loadDetail();
    const interval = setInterval(() => void loadDetail(true), SCREEN_DETAIL_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedScreen]);

  async function createScreen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);

    try {
      await apiClient.createScreen({ name, slug: slug || undefined, location: location || null, orientation });
      toast({ title: "Tela criada", description: name, variant: "success" });
      setName("");
      setSlug("");
      setLocation("");
      setOrientation("landscape");
      await screensQuery.refresh();
    } catch (error) {
      toast({ title: "Falha ao criar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  async function assignPlaylist(screenId: string, playlistId: string) {
    try {
      await apiClient.updateScreen(screenId, { playlistId: playlistId || null });
      toast({ title: "Playlist atribuída", variant: "success" });
      await screensQuery.refresh();
    } catch (error) {
      toast({ title: "Falha ao atribuir playlist", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function updateScreen(input: { name?: string; slug?: string; location?: string | null; orientation?: ScreenOrientation }) {
    if (!selectedScreen) {
      return;
    }

    try {
      await apiClient.updateScreen(selectedScreen.id, input);
      toast({ title: "Tela atualizada", variant: "success" });
      await screensQuery.refresh();
      setDetail(await apiClient.getScreen(selectedScreen.id));
    } catch (error) {
      toast({ title: "Falha ao atualizar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function sendCommand(type: ScreenCommandType) {
    if (!selectedScreen) {
      return;
    }

    try {
      await apiClient.createScreenCommand(selectedScreen.id, type);
      toast({ title: "Comando enviado", description: commandLabels[type], variant: "success" });
      setDetail(await apiClient.getScreen(selectedScreen.id));
    } catch (error) {
      toast({ title: "Falha no comando", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function sendRemoteKey(key: RemoteControlKey) {
    if (!selectedScreen) {
      return;
    }

    try {
      await apiClient.createScreenCommand(selectedScreen.id, "remote_key", { key });
      toast({ title: "Tecla enviada", description: remoteKeyLabels[key], variant: "success" });
      setDetail(await apiClient.getScreen(selectedScreen.id));
    } catch (error) {
      toast({ title: "Falha no controle", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function confirmDeleteScreen() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      await apiClient.deleteScreen(deleteTarget.id);
      toast({ title: "Tela apagada", description: deleteTarget.name, variant: "success" });
      if (selectedScreen?.id === deleteTarget.id) {
        setSelectedScreen(null);
        setDetail(null);
      }
      setDeleteTarget(null);
      await screensQuery.refresh();
    } catch (error) {
      toast({ title: "Falha ao apagar tela", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Card className="h-fit bg-card/70">
          <CardHeader>
            <CardTitle>Criar tela</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createScreen}>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Tela da recepção"
                required
                value={name}
              />
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setSlug(event.currentTarget.value)}
                placeholder="tela-recepcao"
                value={slug}
              />
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setLocation(event.currentTarget.value)}
                placeholder="Local"
                value={location}
              />
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setOrientation(event.currentTarget.value as ScreenOrientation)}
                value={orientation}
              >
                <option value="landscape">Tela horizontal</option>
                <option value="portrait">Tela vertical</option>
              </select>
              <Button className="w-full" disabled={isCreating} type="submit">
                <MonitorUp className="h-4 w-4" aria-hidden="true" />
                {isCreating ? "Criando..." : "Criar tela"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {screensQuery.error || playlistsQuery.error ? (
          <ErrorBanner message={screensQuery.error ?? playlistsQuery.error ?? "Não foi possível carregar as telas."} />
        ) : screensQuery.isLoading || playlistsQuery.isLoading ? (
          <LoadingSkeleton className="h-96" />
        ) : screens.length === 0 ? (
          <EmptyState icon={Tv} title="Nenhuma tela cadastrada" description="Crie uma tela para gerar um código de ativação." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {screens.map((screen) => (
              <ScreenCard
                key={screen.id}
                onAssign={assignPlaylist}
                onDelete={setDeleteTarget}
                onSelect={setSelectedScreen}
                playlists={playlists}
                screen={screen}
              />
            ))}
          </div>
        )}
      </div>

      {selectedScreen ? (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l bg-card p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{selectedScreen.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedScreen.slug}</p>
              </div>
              <Button onClick={() => setSelectedScreen(null)} type="button" variant="ghost">
                Fechar
              </Button>
            </div>

            {detailError ? <p className="mt-4 rounded-md border border-destructive/40 p-3 text-sm">{detailError}</p> : null}
            {!detail && !detailError ? <LoadingSkeleton className="mt-6 h-96" /> : null}
            {detail ? (
              <div className="mt-6 space-y-5">
                <LivePreview detail={detail} />
                <div className="grid gap-3 rounded-lg border bg-background/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge status={detail.status} />
                  </div>
                  <DetailLine label="Playlist atribuída" value={detail.activeAssignment?.playlist.name ?? "Nenhuma"} />
                  <DetailLine label="Orientação" value={screenOrientationLabels[detail.orientation]} />
                  <DetailLine label="Código de ativação" value={detail.activationCode} mono />
                  <DetailLine label="Última atividade" value={formatDate(detail.lastSeenAt)} />
                  <DetailLine label="Último sinal" value={formatDate(detail.lastHeartbeat?.sentAt)} />
                  <DetailLine label="Versão do aplicativo" value={detail.lastHeartbeat?.appVersion ?? "Desconhecida"} />
                  <DetailLine label="Endereço IP" value={detail.lastHeartbeat?.ipAddress ?? "Desconhecido"} />
                  <DetailLine label="Mídia atual" value={detail.lastHeartbeat?.currentMedia?.title ?? "Nenhuma"} />
                </div>
                <VirtualRemote onRemoteKey={sendRemoteKey} />
                <RemoteCommands onCommand={sendCommand} />
                <RecentCommands detail={detail} />
                <RecentEvents detail={detail} />
                <EditScreenForm detail={detail} key={detail.id} onSave={updateScreen} />
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <h3 className="font-semibold">Apagar tela</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Remove esta tela, o histórico de sinais, eventos, comandos e vínculos com playlists.
                  </p>
                  <Button className="mt-4" onClick={() => setDeleteTarget(detail)} type="button" variant="destructive">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Apagar tela
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Apagar tela?"
        description={
          deleteTarget
            ? `A tela "${deleteTarget.name}" será removida junto com seu histórico de sinais, eventos e comandos.`
            : "Essa ação não pode ser desfeita."
        }
        confirmLabel="Apagar"
        isLoading={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteScreen}
      />
    </AppShell>
  );
}

const commandLabels: Record<ScreenCommandType, string> = {
  refresh_playlist: "Atualizar playlist",
  clear_cache: "Limpar cache",
  restart_player: "Reiniciar reprodutor",
  reload_app: "Recarregar aplicativo",
  open_overlay_settings: "Abrir permissão de sobreposição",
  remote_key: "Controle remoto"
};

const remoteKeyLabels: Record<RemoteControlKey, string> = {
  up: "Cima",
  down: "Baixo",
  left: "Esquerda",
  right: "Direita",
  select: "OK",
  back: "Voltar"
};

const playbackStateLabels = {
  idle: "Aguardando",
  playing: "Reproduzindo",
  paused: "Pausado",
  transitioning: "Transição",
  error: "Erro"
};

const commandStatusLabels: Record<ScreenCommandStatus, string> = {
  pending: "Pendente",
  delivered: "Entregue",
  acknowledged: "Confirmado",
  failed: "Falhou"
};

const screenEventLevelLabels: Record<ScreenEventLevel, string> = {
  info: "Info",
  warn: "Aviso",
  error: "Erro"
};

const screenEventTypeLabels: Record<string, string> = {
  playlist_synced: "Playlist sincronizada",
  playlist_sync_failed: "Falha ao sincronizar playlist",
  player_restarted: "Reprodutor reiniciado",
  playback_error: "Erro de reprodução"
};

const screenOrientationLabels: Record<ScreenOrientation, string> = {
  landscape: "Horizontal",
  portrait: "Vertical"
};

function LivePreview({ detail }: { detail: ScreenDetailDto }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const heartbeat = detail.lastHeartbeat;
  const media = heartbeat?.currentMedia ?? null;
  const playlistItem = useMemo(() => {
    const items = detail.activeAssignment?.playlist.items ?? [];
    return (
      items.find((item) => item.id === heartbeat?.currentPlaylistItemId) ??
      items.find((item) => item.mediaId === heartbeat?.currentMediaId) ??
      null
    );
  }, [detail.activeAssignment?.playlist.items, heartbeat?.currentMediaId, heartbeat?.currentPlaylistItemId]);
  const durationSeconds =
    heartbeat?.playbackDurationSeconds ??
    playlistItem?.displayDurationSeconds ??
    playlistItem?.media.durationSeconds ??
    media?.durationSeconds ??
    null;
  const positionSeconds = useSyncedPlaybackPosition(
    heartbeat?.sentAt ?? null,
    heartbeat?.playbackPositionSeconds ?? null,
    durationSeconds,
    heartbeat?.playbackState ?? null
  );
  const progressPercent =
    durationSeconds && positionSeconds !== null ? Math.min(100, Math.max(0, (positionSeconds / durationSeconds) * 100)) : 0;
  const previewAspectClass = detail.orientation === "portrait" ? "aspect-[9/16] max-h-[28rem]" : "aspect-video";

  useEffect(() => {
    if (!media || media.type !== "video" || !heartbeat) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const sentAt = new Date(heartbeat.sentAt).getTime();
    const elapsedSeconds =
      heartbeat.playbackState === "playing" && Number.isFinite(sentAt) ? Math.max(0, (Date.now() - sentAt) / 1000) : 0;
    const targetSeconds = Math.min(
      durationSeconds ?? Number.POSITIVE_INFINITY,
      (heartbeat.playbackPositionSeconds ?? 0) + elapsedSeconds
    );

    if (Number.isFinite(targetSeconds) && Math.abs(video.currentTime - targetSeconds) > 1.25) {
      video.currentTime = targetSeconds;
    }

    if (heartbeat.playbackState === "playing") {
      void video.play().catch(() => undefined);
    }
  }, [durationSeconds, heartbeat, media]);

  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Preview ao vivo</h3>
        <span className="rounded-full border px-2 py-0.5 text-xs">
          {getPlaybackStateLabel(heartbeat?.playbackState)}
        </span>
      </div>
      <div className={`mx-auto mt-3 flex w-full items-center justify-center overflow-hidden rounded-md bg-black ${previewAspectClass}`}>
        {media ? (
          media.type === "image" ? (
            <img
              alt={media.title}
              className="h-full w-full object-contain"
              src={media.fileUrl}
              style={{ transform: `rotate(${media.rotationDegrees}deg)` }}
            />
          ) : (
            <video
              className="h-full w-full object-contain"
              loop
              muted
              playsInline
              ref={videoRef}
              src={media.fileUrl}
              style={{ transform: `rotate(${media.rotationDegrees}deg)` }}
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <MonitorPlay className="h-8 w-8" aria-hidden="true" />
            <span className="text-sm">Aguardando mídia atual</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{media?.title ?? "Nenhuma mídia em reprodução"}</span>
          <span className="font-mono">
            {formatSeconds(positionSeconds)} / {formatSeconds(durationSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}

function VirtualRemote({ onRemoteKey }: { onRemoteKey: (key: RemoteControlKey) => void }) {
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <h3 className="font-semibold">Controle remoto virtual</h3>
      <div className="mx-auto mt-3 grid max-w-[12rem] grid-cols-3 gap-2">
        <span />
        <Button onClick={() => onRemoteKey("up")} size="icon" title="Cima" type="button" variant="secondary">
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span />
        <Button onClick={() => onRemoteKey("left")} size="icon" title="Esquerda" type="button" variant="secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button onClick={() => onRemoteKey("select")} title="OK" type="button">
          <CircleDot className="h-4 w-4" aria-hidden="true" />
          OK
        </Button>
        <Button onClick={() => onRemoteKey("right")} size="icon" title="Direita" type="button" variant="secondary">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span />
        <Button onClick={() => onRemoteKey("down")} size="icon" title="Baixo" type="button" variant="secondary">
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span />
      </div>
      <Button className="mt-3 w-full" onClick={() => onRemoteKey("back")} type="button" variant="secondary">
        <CornerDownLeft className="h-4 w-4" aria-hidden="true" />
        Voltar
      </Button>
    </div>
  );
}

function useSyncedPlaybackPosition(
  sentAt: string | null,
  positionSeconds: number | null,
  durationSeconds: number | null,
  playbackState: string | null
) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [sentAt, positionSeconds, durationSeconds, playbackState]);

  if (positionSeconds === null) {
    return null;
  }

  const sentAtMs = sentAt ? new Date(sentAt).getTime() : Number.NaN;
  const elapsedSeconds = playbackState === "playing" && Number.isFinite(sentAtMs) ? Math.max(0, (now - sentAtMs) / 1000) : 0;
  const livePosition = positionSeconds + elapsedSeconds;

  return durationSeconds ? Math.min(durationSeconds, livePosition) : livePosition;
}

function formatSeconds(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--:--";
  }

  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getPlaybackStateLabel(value: string | null | undefined) {
  if (!value) {
    return "Sem sinal";
  }

  return value in playbackStateLabels ? playbackStateLabels[value as keyof typeof playbackStateLabels] : value;
}

function getCommandLabel(command: ScreenCommandDto) {
  if (command.type !== "remote_key") {
    return commandLabels[command.type];
  }

  const key = command.payload?.key;
  return isRemoteControlKey(key) ? `Controle: ${remoteKeyLabels[key]}` : commandLabels.remote_key;
}

function isRemoteControlKey(value: unknown): value is RemoteControlKey {
  return typeof value === "string" && value in remoteKeyLabels;
}

function RemoteCommands({ onCommand }: { onCommand: (type: ScreenCommandType) => void }) {
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <h3 className="font-semibold">Comandos remotos</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button onClick={() => onCommand("refresh_playlist")} type="button" variant="secondary">
          <Wifi className="h-4 w-4" aria-hidden="true" />
          Atualizar agora
        </Button>
        <Button onClick={() => onCommand("clear_cache")} type="button" variant="secondary">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Limpar cache
        </Button>
        <Button onClick={() => onCommand("restart_player")} type="button" variant="secondary">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reiniciar reprodutor
        </Button>
        <Button onClick={() => onCommand("reload_app")} type="button" variant="secondary">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Recarregar aplicativo
        </Button>
        <Button onClick={() => onCommand("open_overlay_settings")} type="button" variant="secondary">
          <Settings className="h-4 w-4" aria-hidden="true" />
          Permitir sobrepor
        </Button>
      </div>
    </div>
  );
}

function RecentCommands({ detail }: { detail: ScreenDetailDto }) {
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <h3 className="font-semibold">Últimos comandos</h3>
      <div className="mt-3 grid gap-2">
        {detail.recentCommands.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comando enviado.</p>
        ) : (
          detail.recentCommands.map((command) => (
            <div className="rounded-md border bg-card/50 p-3 text-sm" key={command.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{getCommandLabel(command)}</span>
                <span className="rounded-full border px-2 py-0.5 text-xs">{commandStatusLabels[command.status]}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(command.requestedAt)}</p>
              {command.errorMessage ? <p className="mt-1 text-xs text-destructive">{command.errorMessage}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentEvents({ detail }: { detail: ScreenDetailDto }) {
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <h3 className="font-semibold">Eventos da TV</h3>
      <div className="mt-3 grid gap-2">
        {detail.recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento recebido.</p>
        ) : (
          detail.recentEvents.map((event) => (
            <div className="rounded-md border bg-card/50 p-3 text-sm" key={event.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{screenEventTypeLabels[event.type] ?? event.type}</span>
                <span className="rounded-full border px-2 py-0.5 text-xs">{screenEventLevelLabels[event.level]}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{event.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DetailLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function EditScreenForm({
  detail,
  onSave
}: {
  detail: ScreenDetailDto;
  onSave: (input: { name: string; slug: string; location: string | null; orientation: ScreenOrientation }) => void;
}) {
  const [name, setName] = useState(detail.name);
  const [slug, setSlug] = useState(detail.slug);
  const [location, setLocation] = useState(detail.location ?? "");
  const [orientation, setOrientation] = useState<ScreenOrientation>(detail.orientation);

  return (
    <form
      className="space-y-4 rounded-lg border bg-background/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name, slug, location: location || null, orientation });
      }}
    >
      <h3 className="font-semibold">Editar tela</h3>
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setName(event.currentTarget.value)}
        value={name}
      />
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setSlug(event.currentTarget.value)}
        value={slug}
      />
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setLocation(event.currentTarget.value)}
        value={location}
      />
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setOrientation(event.currentTarget.value as ScreenOrientation)}
        value={orientation}
      >
        <option value="landscape">Tela horizontal</option>
        <option value="portrait">Tela vertical</option>
      </select>
      <Button type="submit">Salvar tela</Button>
    </form>
  );
}
