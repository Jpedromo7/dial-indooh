import { useCallback, useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { COMMAND_POLL_MS, HEARTBEAT_MS, LIVE_PREVIEW_HEARTBEAT_MS } from "../config/appConfig";
import { BrandLogo } from "../components/BrandLogo";
import { FooterBar } from "../components/FooterBar";
import { ManifestPlayer } from "../components/player/ManifestPlayer";
import { ApiError } from "../services/apiClient";
import { reportPreviousUpdate } from "../services/appUpdater";
import { postHeartbeat } from "../services/heartbeat";
import { loadOfflineManifest, syncManifest } from "../services/manifestSync";
import { maybeDailyRestart, resumeWatchdog } from "../services/maintenance";
import { flushPlays } from "../services/playLog";
import { pollAndRunScreenCommands } from "../services/screenCommands";
import { reportScreenEvent } from "../services/screenEvents";
import type { DeviceSession, PlaybackStatus, RemoteKeyCommand, TvItem, TvManifest } from "../types/signage";
import { getErrorMessage } from "../utils/errors";

type LoadedManifest = TvManifest & { items: TvItem[] };

const PLAY_FLUSH_MS = 60 * 1000;
const FOOTER_HEIGHT_RATIO = 0.085;

interface PlayerScreenProps {
  onSessionExpired: () => Promise<void>;
  session: DeviceSession;
}

export function PlayerScreen({ onSessionExpired, session }: PlayerScreenProps) {
  const [manifest, setManifest] = useState<LoadedManifest | null>(null);
  const [manifestVersion, setManifestVersion] = useState("initial");
  const [statusMessage, setStatusMessage] = useState("Carregando programação");
  const [playerKey, setPlayerKey] = useState(0);
  const [remoteKeyCommand, setRemoteKeyCommand] = useState<RemoteKeyCommand | null>(null);
  const window = useWindowDimensions();
  const playbackStatusRef = useRef<PlaybackStatus>(emptyStatus);
  const fingerprintRef = useRef<string>("");

  const applyManifest = useCallback((next: LoadedManifest | null) => {
    setManifest(next);

    if (!next) return;

    // Só reinicia a reprodução quando a lista realmente mudou (widgets atualizam dados sem cortar a mídia atual).
    const fingerprint = JSON.stringify([
      next.screen,
      next.items.map((item) => [item.key, item.fileUrl, item.durationSeconds, item.schedule, item.config])
    ]);

    if (fingerprint !== fingerprintRef.current) {
      fingerprintRef.current = fingerprint;
      setManifestVersion(String(Date.now()));
    }
  }, []);

  const refreshManifest = useCallback(async () => {
    try {
      const synced = await syncManifest(session);
      applyManifest(synced);
      setStatusMessage(synced.items.length ? "" : "Nenhuma mídia na lista deste terminal");
    } catch (error) {
      if (isExpiredSession(error)) {
        await onSessionExpired();
        return;
      }

      const offline = await loadOfflineManifest();
      if (offline) {
        applyManifest(offline);
      }
      setStatusMessage(offline?.items.length ? "" : `Sem conexão: ${getErrorMessage(error)}`);
      void reportScreenEvent(session, { level: "warn", type: "playlist_sync_failed", message: getErrorMessage(error) });
    }
  }, [applyManifest, onSessionExpired, session]);

  // Primeira carga: usa o cache imediatamente e sincroniza em seguida.
  useEffect(() => {
    void loadOfflineManifest().then((offline) => {
      if (offline) applyManifest(offline);
    });
    void refreshManifest();
  }, [applyManifest, refreshManifest]);

  // Ciclo de atualização definido no painel (por terminal).
  const refreshMinutes = manifest?.screen.refreshMinutes ?? 5;
  useEffect(() => {
    const interval = setInterval(() => void refreshManifest(), Math.max(1, refreshMinutes) * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshManifest, refreshMinutes]);

  useEffect(() => {
    const send = () => postHeartbeat(session, playbackStatusRef.current).catch(() => undefined);
    void send();
    const interval = setInterval(send, Math.min(HEARTBEAT_MS, LIVE_PREVIEW_HEARTBEAT_MS));
    return () => clearInterval(interval);
  }, [session]);

  // Vigia ativo enquanto o player roda; reinício diário de madrugada.
  const timezone = manifest?.screen.timezone ?? "America/Sao_Paulo";
  useEffect(() => {
    void resumeWatchdog();
    const interval = setInterval(() => void maybeDailyRestart(timezone, session), 60 * 1000);
    return () => clearInterval(interval);
  }, [session, timezone]);

  useEffect(() => {
    void reportPreviousUpdate(session);
  }, [session]);

  useEffect(() => {
    void flushPlays(session);
    const interval = setInterval(() => void flushPlays(session), PLAY_FLUSH_MS);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    const run = () =>
      pollAndRunScreenCommands(session, {
        refreshPlaylist: refreshManifest,
        restartPlayer: () => {
          setPlayerKey((value) => value + 1);
          void reportScreenEvent(session, { level: "info", type: "player_restarted", message: "Reprodutor reiniciado por comando remoto." });
        },
        remoteKey: (key, commandId) => setRemoteKeyCommand({ id: commandId, key }),
        startScreenMirror: async (sessionId) => {
          // WebRTC é pesado: só carrega quando alguém abre o espelhamento.
          const { startScreenMirror } = await import("../services/screenMirror");
          await startScreenMirror(session, sessionId);
          await reportScreenEvent(session, { level: "info", type: "screen_mirror_started", message: "Espelhamento de tela iniciado." });
        },
        stopScreenMirror: async () => {
          const { stopScreenMirror } = await import("../services/screenMirror");
          await stopScreenMirror();
          await reportScreenEvent(session, { level: "info", type: "screen_mirror_stopped", message: "Espelhamento de tela encerrado." });
        }
      }).catch(() => undefined);

    void run();
    const interval = setInterval(run, COMMAND_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshManifest, session]);

  const orientation = manifest?.screen.orientation ?? "landscape";
  const portrait = orientation === "portrait";
  // Na TV vertical, giramos a moldura: a "largura" útil é a altura física.
  const frameWidth = portrait ? window.height : window.width;
  const frameHeight = portrait ? window.width : window.height;
  const footer = manifest?.footer ?? null;
  const footerHeight = footer ? Math.round(frameHeight * FOOTER_HEIGHT_RATIO) : 0;
  const splashUrl = manifest?.branding.splashUrl ?? null;

  const idle = (
    <View style={styles.idle}>
      {splashUrl ? <Image resizeMode="contain" source={{ uri: splashUrl }} style={styles.splash} /> : <BrandLogo size={96} />}
      {statusMessage ? <Text style={styles.idleMessage}>{statusMessage}</Text> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View
        style={
          portrait
            ? { height: frameHeight, width: frameWidth, transform: [{ rotate: "90deg" }] }
            : { height: frameHeight, width: frameWidth }
        }
      >
        <View style={{ flex: 1 }}>
          {manifest ? (
            <ManifestPlayer
              idle={idle}
              items={manifest.items}
              key={playerKey}
              manifestVersion={manifestVersion}
              muted={!manifest.screen.soundEnabled}
              onError={(item, message) => {
                void reportScreenEvent(session, { level: "error", type: "playback_error", message, mediaId: item.mediaId });
              }}
              onStatusChange={(status) => {
                playbackStatusRef.current = status;
              }}
              orientation={orientation}
              remoteKeyCommand={remoteKeyCommand}
              shuffle={manifest.screen.shuffle}
              timezone={manifest.screen.timezone}
            />
          ) : (
            idle
          )}
        </View>
        {footer ? <FooterBar footer={footer} height={footerHeight} timezone={manifest?.screen.timezone ?? "America/Sao_Paulo"} /> : null}
      </View>
    </View>
  );
}

function isExpiredSession(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.code === "screen_not_found" || error.code === "invalid_device_key" || error.code === "device_key_required")
  );
}

const emptyStatus: PlaybackStatus = { currentItem: null, durationSeconds: null, positionSeconds: null, state: "idle" };

const styles = StyleSheet.create({
  idle: {
    alignItems: "center",
    backgroundColor: "#060910",
    flex: 1,
    gap: 24,
    justifyContent: "center",
    padding: 48
  },
  idleMessage: {
    color: "#a8b3c7",
    fontSize: 22,
    textAlign: "center"
  },
  screen: {
    alignItems: "center",
    backgroundColor: "#000000",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  splash: {
    height: "50%",
    width: "50%"
  }
});
