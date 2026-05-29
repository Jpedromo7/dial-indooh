import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ScreenOrientation } from "@dialindooh/shared";
import { COMMAND_POLL_MS, HEARTBEAT_MS, LIVE_PREVIEW_HEARTBEAT_MS, PLAYLIST_REFRESH_MS } from "../config/appConfig";
import { BrandLogo } from "../components/BrandLogo";
import { PlaylistController } from "../components/player/PlaylistController";
import { postHeartbeat } from "../services/heartbeat";
import { hasPlayableItems, loadOfflinePlayback, syncPlaylist } from "../services/playlistSync";
import { pollAndRunScreenCommands } from "../services/screenCommands";
import { reportScreenEvent } from "../services/screenEvents";
import { startScreenMirror, stopScreenMirror } from "../services/screenMirror";
import type { DeviceSession, PlaybackStatus, RemoteKeyCommand, TvPlaylist } from "../types/signage";
import { getErrorMessage } from "../utils/errors";

interface PlayerScreenProps {
  session: DeviceSession;
}

export function PlayerScreen({ session }: PlayerScreenProps) {
  const [playlist, setPlaylist] = useState<TvPlaylist | null>(null);
  const [screenOrientation, setScreenOrientation] = useState<ScreenOrientation>("landscape");
  const [statusMessage, setStatusMessage] = useState("Carregando playlist");
  const [playerKey, setPlayerKey] = useState(0);
  const [remoteKeyCommand, setRemoteKeyCommand] = useState<RemoteKeyCommand | null>(null);
  const windowDimensions = useWindowDimensions();
  const playbackStatusRef = useRef<PlaybackStatus>(emptyPlaybackStatus);

  const updatePlaybackStatus = useCallback((status: PlaybackStatus) => {
    playbackStatusRef.current = status;
  }, []);

  const refreshPlaylist = useCallback(async () => {
    try {
      const syncedPlayback = await syncPlaylist(session);
      setPlaylist(syncedPlayback.playlist);
      setScreenOrientation(syncedPlayback.screenOrientation);
      setStatusMessage(getPlaylistStatusMessage(syncedPlayback.playlist));
      await reportScreenEvent(session, {
        level: "info",
        type: "playlist_synced",
        message: `Playlist sincronizada com ${syncedPlayback.playlist?.items.length ?? 0} item(ns) reproduzível(is).`
      });
    } catch (error) {
      const offlinePlayback = await loadOfflinePlayback();
      setPlaylist(offlinePlayback.playlist);
      setScreenOrientation(offlinePlayback.screenOrientation);
      setStatusMessage(hasPlayableItems(offlinePlayback.playlist) ? "" : `Modo offline: ${getErrorMessage(error)}`);
      await reportScreenEvent(session, {
        level: "warn",
        type: "playlist_sync_failed",
        message: getErrorMessage(error)
      });
    }
  }, [session]);

  useEffect(() => {
    void refreshPlaylist();
    const interval = setInterval(() => void refreshPlaylist(), PLAYLIST_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshPlaylist]);

  useEffect(() => {
    const send = () => postHeartbeat(session, playbackStatusRef.current).catch(() => undefined);
    void send();
    const interval = setInterval(send, Math.min(HEARTBEAT_MS, LIVE_PREVIEW_HEARTBEAT_MS));
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    const run = () =>
      pollAndRunScreenCommands(session, {
        refreshPlaylist,
        restartPlayer: () => {
          setPlayerKey((currentKey) => currentKey + 1);
          void reportScreenEvent(session, {
            level: "info",
            type: "player_restarted",
            message: "Reprodutor reiniciado por comando remoto."
          });
        },
        remoteKey: (key, commandId) => {
          setRemoteKeyCommand({ id: commandId, key });
        },
        startScreenMirror: async (sessionId) => {
          await startScreenMirror(session, sessionId);
          await reportScreenEvent(session, {
            level: "info",
            type: "screen_mirror_started",
            message: "Espelhamento de tela iniciado por comando remoto."
          });
        },
        stopScreenMirror: async () => {
          await stopScreenMirror();
          await reportScreenEvent(session, {
            level: "info",
            type: "screen_mirror_stopped",
            message: "Espelhamento de tela encerrado por comando remoto."
          });
        }
      }).catch(() => undefined);

    void run();
    const interval = setInterval(run, COMMAND_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshPlaylist, session]);

  const showStatus = Boolean(statusMessage && !hasPlayableItems(playlist));

  return (
    <View style={styles.screen}>
      <View style={[styles.playbackFrame, getPlaybackFrameStyle(screenOrientation, windowDimensions)]}>
        <PlaylistController
          key={playerKey}
          onPlaybackStatusChange={updatePlaybackStatus}
          onPlaybackError={(item, message) => {
            playbackStatusRef.current = {
              currentItem: item,
              durationSeconds: item.media.durationSeconds,
              positionSeconds: null,
              state: "error"
            };
            setStatusMessage(message);
            void reportScreenEvent(session, {
              level: "error",
              type: "playback_error",
              message,
              mediaId: item.mediaId
            });
          }}
          playlist={playlist}
          remoteKeyCommand={remoteKeyCommand}
          screenOrientation={screenOrientation}
        />
      </View>
      {showStatus ? (
        <View style={styles.emptyOverlay}>
          <BrandLogo size={92} />
          <Text style={styles.emptyTitle}>Dial indoor TV</Text>
          <Text style={styles.emptyMessage}>{statusMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const emptyPlaybackStatus: PlaybackStatus = {
  currentItem: null,
  durationSeconds: null,
  positionSeconds: null,
  state: "idle"
};

function getPlaybackFrameStyle(
  orientation: ScreenOrientation,
  windowDimensions: {
    width: number;
    height: number;
  }
) {
  if (orientation === "portrait") {
    return {
      height: windowDimensions.width,
      transform: [{ rotate: "90deg" }],
      width: windowDimensions.height
    };
  }

  return styles.landscapeFrame;
}

function getPlaylistStatusMessage(playlist: TvPlaylist | null) {
  if (hasPlayableItems(playlist)) {
    return "";
  }

  return playlist ? "Nenhuma mídia reproduzível" : "Nenhuma playlist atribuída";
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: "#000000",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  landscapeFrame: {
    height: "100%",
    width: "100%"
  },
  playbackFrame: {
    backgroundColor: "#000000"
  },
  emptyMessage: {
    color: "#a8b3c7",
    fontSize: 20,
    lineHeight: 28,
    maxWidth: 620,
    textAlign: "center"
  },
  emptyOverlay: {
    alignItems: "center",
    backgroundColor: "#060910",
    bottom: 0,
    gap: 16,
    justifyContent: "center",
    left: 0,
    padding: 48,
    position: "absolute",
    right: 0,
    top: 0
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0
  }
});
