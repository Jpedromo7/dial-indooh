"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  RemoteControlKey,
  ScreenCommandDto,
  ScreenCommandStatus,
  ScreenCommandType,
  ScreenDetailDto,
  ScreenEventLevel,
  ScreenMirrorSessionDto,
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
  ScreenShare,
  ScreenShareOff,
  Settings,
  Trash2,
  Wifi
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export const commandLabels: Record<ScreenCommandType, string> = {
  refresh_playlist: "Atualizar playlist",
  clear_cache: "Limpar cache",
  restart_player: "Reiniciar reprodutor",
  reload_app: "Recarregar aplicativo",
  open_overlay_settings: "Modo manutenção (abre ajustes, pausa vigia 15 min)",
  remote_key: "Controle remoto",
  start_screen_mirror: "Iniciar espelhamento",
  stop_screen_mirror: "Encerrar espelhamento"
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

const mirrorSessionStatusLabels = {
  requested: "Solicitado",
  connecting: "Conectando",
  active: "Ao vivo",
  ended: "Encerrado",
  failed: "Falhou"
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

export const screenOrientationLabels: Record<ScreenOrientation, string> = {
  landscape: "Horizontal",
  portrait: "Vertical"
};

export function LivePreview({ detail }: { detail: ScreenDetailDto }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const heartbeat = detail.lastHeartbeat;
  const media = heartbeat?.currentMedia ?? null;
  const durationSeconds = useMemo(
    () => heartbeat?.playbackDurationSeconds ?? media?.durationSeconds ?? null,
    [heartbeat?.playbackDurationSeconds, media?.durationSeconds]
  );
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
        {media && media.type !== "image" && media.type !== "video" ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-muted-foreground">
            <MonitorPlay className="h-8 w-8" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">{media.title}</span>
            <span className="text-xs">Conteúdo dinâmico em exibição</span>
          </div>
        ) : media ? (
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

export function ScreenMirrorPanel({ detail }: { detail: ScreenDetailDto }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteOfferSetRef = useRef(false);
  const appliedCandidateIdsRef = useRef<Set<string>>(new Set());
  const [session, setSession] = useState<ScreenMirrorSessionDto | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isActiveSession = session && session.status !== "ended" && session.status !== "failed";

  useEffect(() => {
    if (!session || !isActiveSession) {
      return undefined;
    }

    let active = true;
    const poll = async () => {
      try {
        const updatedSession = await apiClient.getScreenMirrorSession(detail.id, session.id);

        if (!active) {
          return;
        }

        setSession(updatedSession);

        if (updatedSession.status === "ended" || updatedSession.status === "failed") {
          closeMirrorViewer();
          return;
        }

        const peerConnection = peerConnectionRef.current ?? createMirrorPeerConnection(detail.id, session.id);
        await acceptMirrorOffer(peerConnection, detail.id, updatedSession);
        await addRemoteMirrorCandidates(peerConnection, detail.id, session.id, appliedCandidateIdsRef.current);
      } catch (error) {
        if (active) {
          setErrorMessage(getApiErrorMessage(error));
        }
      }
    };

    void poll();
    const interval = setInterval(poll, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [detail.id, isActiveSession, session]);

  useEffect(() => () => closeMirrorViewer(), []);

  async function startMirror() {
    if (!("RTCPeerConnection" in window)) {
      setErrorMessage("Este navegador não suporta WebRTC.");
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);
    closeMirrorViewer();

    try {
      const createdSession = await apiClient.createScreenMirrorSession(detail.id);
      setSession(createdSession);
      createMirrorPeerConnection(detail.id, createdSession.id);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }

  async function stopMirror() {
    if (!session) {
      return;
    }

    setIsStopping(true);

    try {
      const stoppedSession = await apiClient.stopScreenMirrorSession(detail.id, session.id);
      setSession(stoppedSession);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      closeMirrorViewer();
      setIsStopping(false);
    }
  }

  function createMirrorPeerConnection(screenId: string, sessionId: string) {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
    });

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      void apiClient
        .createScreenMirrorCandidate(screenId, sessionId, {
          peer: "viewer",
          candidate: event.candidate.toJSON()
        })
        .catch((error) => setErrorMessage(getApiErrorMessage(error)));
    };

    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];

      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }

  function closeMirrorViewer() {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    remoteOfferSetRef.current = false;
    appliedCandidateIdsRef.current = new Set();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Espelhamento real</h3>
        <span className="rounded-full border px-2 py-0.5 text-xs">
          {session ? mirrorSessionStatusLabels[session.status] : "Desligado"}
        </span>
      </div>
      <div className="mt-3 aspect-video overflow-hidden rounded-md bg-black">
        <video className="h-full w-full object-contain" muted playsInline ref={videoRef} />
      </div>
      {errorMessage ? <p className="mt-3 rounded-md border border-destructive/40 p-3 text-sm">{errorMessage}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button disabled={isStarting || Boolean(isActiveSession)} onClick={startMirror} type="button">
          <ScreenShare className="h-4 w-4" aria-hidden="true" />
          {isStarting ? "Iniciando..." : "Iniciar espelhamento"}
        </Button>
        <Button disabled={isStopping || !isActiveSession} onClick={stopMirror} type="button" variant="secondary">
          <ScreenShareOff className="h-4 w-4" aria-hidden="true" />
          {isStopping ? "Encerrando..." : "Encerrar"}
        </Button>
      </div>
    </div>
  );

  async function acceptMirrorOffer(
    peerConnection: RTCPeerConnection,
    screenId: string,
    mirrorSession: ScreenMirrorSessionDto
  ) {
    if (!mirrorSession.offer || remoteOfferSetRef.current) {
      return;
    }

    await peerConnection.setRemoteDescription(mirrorSession.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    remoteOfferSetRef.current = true;

    await apiClient.updateScreenMirrorSession(screenId, mirrorSession.id, {
      answer: peerConnection.localDescription?.toJSON() ?? answer,
      status: "active"
    });
  }

  async function addRemoteMirrorCandidates(
    peerConnection: RTCPeerConnection,
    screenId: string,
    sessionId: string,
    appliedCandidateIds: Set<string>
  ) {
    const candidates = await apiClient.listScreenMirrorCandidates(screenId, sessionId);
    const screenCandidates = candidates.filter(
      (candidate) => candidate.peer === "screen" && !appliedCandidateIds.has(candidate.id)
    );

    for (const candidate of screenCandidates) {
      await peerConnection.addIceCandidate(candidate.candidate);
      appliedCandidateIds.add(candidate.id);
    }
  }
}

export function VirtualRemote({ onRemoteKey }: { onRemoteKey: (key: RemoteControlKey) => void }) {
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

export function RemoteCommands({ onCommand }: { onCommand: (type: ScreenCommandType) => void }) {
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

export function RecentCommands({ detail }: { detail: ScreenDetailDto }) {
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

export function RecentEvents({ detail }: { detail: ScreenDetailDto }) {
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

export function DetailLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
