import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { IMAGE_FALLBACK_DURATION_SECONDS } from "../../config/appConfig";
import { clearCorruptedMedia } from "../../services/mediaCache";
import type { TvPlaylist, TvPlaylistItem } from "../../types/signage";
import { ImageDisplay } from "./ImageDisplay";
import { VideoPlayer } from "./VideoPlayer";

interface PlaylistControllerProps {
  playlist: TvPlaylist | null;
  onCurrentItemChange: (item: TvPlaylistItem | null) => void;
  onPlaybackError: (item: TvPlaylistItem, error: string) => void;
}

export function PlaylistController({ playlist, onCurrentItemChange, onPlaybackError }: PlaylistControllerProps) {
  const items = useMemo(() => [...(playlist?.items ?? [])].sort((left, right) => left.order - right.order), [playlist]);
  const [index, setIndex] = useState(0);
  const currentItem = items[index] ?? null;

  const advance = useCallback(() => {
    setIndex((currentIndex) => {
      if (items.length === 0) {
        return 0;
      }

      return (currentIndex + 1) % items.length;
    });
  }, [items.length]);

  useEffect(() => {
    setIndex(0);
  }, [playlist?.id, items.length]);

  useEffect(() => {
    onCurrentItemChange(currentItem);
  }, [currentItem, onCurrentItemChange]);

  useEffect(() => {
    if (!currentItem || currentItem.media.type !== "image") {
      return undefined;
    }

    const durationMs = (currentItem.displayDurationSeconds ?? IMAGE_FALLBACK_DURATION_SECONDS) * 1000;
    const timeout = setTimeout(advance, durationMs);

    return () => clearTimeout(timeout);
  }, [advance, currentItem?.id, currentItem?.displayDurationSeconds]);

  if (!currentItem) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Waiting for playlist</Text>
      </View>
    );
  }

  if (currentItem.media.type === "video") {
    return <VideoPlayer item={currentItem} onEnded={advance} onError={() => handlePlaybackError(currentItem, "Video error")} />;
  }

  return <ImageDisplay item={currentItem} onError={() => handlePlaybackError(currentItem, "Image error")} />;

  async function handlePlaybackError(item: TvPlaylistItem, message: string) {
    await clearCorruptedMedia(item.media.localUri);
    onPlaybackError(item, message);
    advance();
  }
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    backgroundColor: "#000000",
    flex: 1,
    justifyContent: "center"
  },
  emptyText: {
    color: "#333b4c",
    fontSize: 24,
    fontWeight: "700"
  }
});
