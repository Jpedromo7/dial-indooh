import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { HEARTBEAT_MS, PLAYLIST_REFRESH_MS } from "../config/appConfig";
import { PlaylistController } from "../components/player/PlaylistController";
import { postHeartbeat } from "../services/heartbeat";
import { hasPlayableItems, loadOfflinePlaylist, syncPlaylist } from "../services/playlistSync";
import type { DeviceSession, TvPlaylist, TvPlaylistItem } from "../types/signage";
import { getErrorMessage } from "../utils/errors";

interface PlayerScreenProps {
  session: DeviceSession;
}

export function PlayerScreen({ session }: PlayerScreenProps) {
  const [playlist, setPlaylist] = useState<TvPlaylist | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading playlist");
  const currentItemRef = useRef<TvPlaylistItem | null>(null);

  const refreshPlaylist = useCallback(async () => {
    try {
      const syncedPlaylist = await syncPlaylist(session);
      setPlaylist(syncedPlaylist);
      setStatusMessage(hasPlayableItems(syncedPlaylist) ? "" : "No playlist assigned");
    } catch (error) {
      const offlinePlaylist = await loadOfflinePlaylist();
      setPlaylist(offlinePlaylist);
      setStatusMessage(hasPlayableItems(offlinePlaylist) ? "" : `Offline mode: ${getErrorMessage(error)}`);
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

  const showStatus = Boolean(statusMessage && !hasPlayableItems(playlist));

  return (
    <View style={styles.screen}>
      <PlaylistController
        onCurrentItemChange={(item) => {
          currentItemRef.current = item;
        }}
        onPlaybackError={(_, message) => {
          setStatusMessage(message);
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
