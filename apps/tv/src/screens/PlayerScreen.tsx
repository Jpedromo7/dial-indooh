import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ScreenOrientation } from "@dialindooh/shared";
import { COMMAND_POLL_MS, HEARTBEAT_MS, PLAYLIST_REFRESH_MS } from "../config/appConfig";
import { PlaylistController } from "../components/player/PlaylistController";
import { postHeartbeat } from "../services/heartbeat";
import { hasPlayableItems, loadOfflinePlayback, syncPlaylist } from "../services/playlistSync";
import { pollAndRunScreenCommands } from "../services/screenCommands";
import { reportScreenEvent } from "../services/screenEvents";
import type { DeviceSession, TvPlaylist, TvPlaylistItem } from "../types/signage";
import { getErrorMessage } from "../utils/errors";

interface PlayerScreenProps {
  session: DeviceSession;
}

export function PlayerScreen({ session }: PlayerScreenProps) {
  const [playlist, setPlaylist] = useState<TvPlaylist | null>(null);
  const [screenOrientation, setScreenOrientation] = useState<ScreenOrientation>("landscape");
  const [statusMessage, setStatusMessage] = useState("Carregando playlist");
  const [playerKey, setPlayerKey] = useState(0);
  const windowDimensions = useWindowDimensions();
  const currentItemRef = useRef<TvPlaylistItem | null>(null);

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
    const send = () => postHeartbeat(session, currentItemRef.current).catch(() => undefined);
    void send();
    const interval = setInterval(send, HEARTBEAT_MS);
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
          onCurrentItemChange={(item) => {
            currentItemRef.current = item;
          }}
          onPlaybackError={(item, message) => {
            setStatusMessage(message);
            void reportScreenEvent(session, {
              level: "error",
              type: "playback_error",
              message,
              mediaId: item.mediaId
            });
          }}
          playlist={playlist}
          screenOrientation={screenOrientation}
        />
      </View>
      {showStatus ? (
        <View style={styles.statusOverlay}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

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
  statusOverlay: {
    bottom: 22,
    left: 22,
    opacity: 0.72,
    position: "absolute"
  },
  statusText: {
    color: "#7d8798",
    fontSize: 14
  }
});
