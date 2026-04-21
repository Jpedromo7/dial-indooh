import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COMMAND_POLL_MS, HEARTBEAT_MS, PLAYLIST_REFRESH_MS } from "../config/appConfig";
import { PlaylistController } from "../components/player/PlaylistController";
import { postHeartbeat } from "../services/heartbeat";
import { hasPlayableItems, loadOfflinePlaylist, syncPlaylist } from "../services/playlistSync";
import { pollAndRunScreenCommands } from "../services/screenCommands";
import { reportScreenEvent } from "../services/screenEvents";
import type { DeviceSession, TvPlaylist, TvPlaylistItem } from "../types/signage";
import { getErrorMessage } from "../utils/errors";

interface PlayerScreenProps {
  session: DeviceSession;
}

export function PlayerScreen({ session }: PlayerScreenProps) {
  const [playlist, setPlaylist] = useState<TvPlaylist | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading playlist");
  const [playerKey, setPlayerKey] = useState(0);
  const currentItemRef = useRef<TvPlaylistItem | null>(null);

  const refreshPlaylist = useCallback(async () => {
    try {
      const syncedPlaylist = await syncPlaylist(session);
      setPlaylist(syncedPlaylist);
      setStatusMessage(getPlaylistStatusMessage(syncedPlaylist));
      await reportScreenEvent(session, {
        level: "info",
        type: "playlist_synced",
        message: `Playlist synced with ${syncedPlaylist?.items.length ?? 0} playable items.`
      });
    } catch (error) {
      const offlinePlaylist = await loadOfflinePlaylist();
      setPlaylist(offlinePlaylist);
      setStatusMessage(hasPlayableItems(offlinePlaylist) ? "" : `Offline mode: ${getErrorMessage(error)}`);
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
            message: "Player restarted by remote command."
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
      />
      {showStatus ? (
        <View style={styles.statusOverlay}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

function getPlaylistStatusMessage(playlist: TvPlaylist | null) {
  if (hasPlayableItems(playlist)) {
    return "";
  }

  return playlist ? "No playable media" : "No playlist assigned";
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#000000",
    flex: 1
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
