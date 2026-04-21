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
  const [failedItemIds, setFailedItemIds] = useState<Set<string>>(() => new Set());
  const rawItems = useMemo(() => [...(playlist?.items ?? [])].sort((left, right) => left.order - right.order), [playlist]);
  const items = useMemo(
    () => rawItems.filter((item) => !failedItemIds.has(item.id)),
    [failedItemIds, rawItems]
  );
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const currentItem = items[index] ?? null;

  const advance = useCallback(() => {
    setCycle((currentCycle) => currentCycle + 1);
    setIndex((currentIndex) => {
      if (items.length === 0) {
        return 0;
      }

      return (currentIndex + 1) % items.length;
    });
  }, [items.length]);

  useEffect(() => {
    setIndex(0);
    setCycle(0);
    setFailedItemIds(new Set());
  }, [playlist?.id, rawItems.length]);

  useEffect(() => {
    setIndex((currentIndex) => {
      if (items.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, items.length - 1);
    });
  }, [items.length]);

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
  }, [advance, currentItem?.id, currentItem?.displayDurationSeconds, cycle]);

  if (!currentItem) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Waiting for playlist</Text>
      </View>
    );
  }

  if (currentItem.media.type === "video") {
    return (
      <VideoPlayer
        item={currentItem}
        key={`${currentItem.id}-${cycle}`}
        onEnded={advance}
        onError={() => handlePlaybackError(currentItem, "Video error")}
        shouldLoop={items.length === 1}
      />
    );
  }

  return (
    <ImageDisplay
      item={currentItem}
      key={`${currentItem.id}-${cycle}`}
      onError={() => handlePlaybackError(currentItem, "Image error")}
    />
  );

  async function handlePlaybackError(item: TvPlaylistItem, message: string) {
    await clearCorruptedMedia(item.media.localUri);
    setFailedItemIds((currentFailedItemIds) => new Set(currentFailedItemIds).add(item.id));
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
