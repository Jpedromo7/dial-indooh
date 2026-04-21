import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { IMAGE_FALLBACK_DURATION_SECONDS } from "../../config/appConfig";
import { clearCorruptedMedia } from "../../services/mediaCache";
import type { TvPlaylist, TvPlaylistItem } from "../../types/signage";
import { ImageDisplay } from "./ImageDisplay";
import { VideoPlayer } from "./VideoPlayer";

const VIDEO_FALLBACK_DURATION_SECONDS = 30;
const VIDEO_ADVANCE_EARLY_MS = 2500;
const PLAYBACK_TRANSITION_MS = 500;

interface PlaylistControllerProps {
  playlist: TvPlaylist | null;
  onCurrentItemChange: (item: TvPlaylistItem | null) => void;
  onPlaybackError: (item: TvPlaylistItem, error: string) => void;
}

export function PlaylistController({ playlist, onCurrentItemChange, onPlaybackError }: PlaylistControllerProps) {
  const [failedItemIds, setFailedItemIds] = useState<Set<string>>(() => new Set());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const advanceLockRef = useRef(false);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawItems = useMemo(() => [...(playlist?.items ?? [])].sort((left, right) => left.order - right.order), [playlist]);
  const items = useMemo(
    () => rawItems.filter((item) => !failedItemIds.has(item.id)),
    [failedItemIds, rawItems]
  );
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const currentItem = items[index] ?? null;

  const advance = useCallback(() => {
    if (advanceLockRef.current) {
      return;
    }

    advanceLockRef.current = true;
    setIsTransitioning(true);

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    transitionTimeoutRef.current = setTimeout(() => {
      setCycle((currentCycle) => currentCycle + 1);
      setIndex((currentIndex) => {
        if (items.length === 0) {
          return 0;
        }

        return (currentIndex + 1) % items.length;
      });
      setIsTransitioning(false);
      advanceLockRef.current = false;
      transitionTimeoutRef.current = null;
    }, PLAYBACK_TRANSITION_MS);
  }, [items.length]);

  useEffect(() => {
    setIndex(0);
    setCycle(0);
    setFailedItemIds(new Set());
    setIsTransitioning(false);
    advanceLockRef.current = false;
  }, [playlist?.id, playlist?.updatedAt, rawItems.length]);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

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
    if (!currentItem || isTransitioning) {
      return undefined;
    }

    const durationSeconds =
      currentItem.media.type === "image"
        ? currentItem.displayDurationSeconds ?? IMAGE_FALLBACK_DURATION_SECONDS
        : currentItem.media.durationSeconds ?? VIDEO_FALLBACK_DURATION_SECONDS;
    const durationMs =
      currentItem.media.type === "video"
        ? Math.max(1000, durationSeconds * 1000 - VIDEO_ADVANCE_EARLY_MS)
        : durationSeconds * 1000;
    const timeout = setTimeout(advance, durationMs);

    return () => clearTimeout(timeout);
  }, [
    advance,
    currentItem?.id,
    currentItem?.displayDurationSeconds,
    currentItem?.media.durationSeconds,
    currentItem?.media.type,
    cycle,
    isTransitioning
  ]);

  if (!currentItem || isTransitioning) {
    return (
      <View style={styles.empty}>
        {!currentItem ? <Text style={styles.emptyText}>Waiting for playlist</Text> : null}
      </View>
    );
  }

  if (currentItem.media.type === "video") {
    return (
      <VideoPlayer
        item={currentItem}
        key={`${currentItem.id}-${cycle}`}
        onAdvanceCue={advance}
        onError={() => handlePlaybackError(currentItem, "Video error")}
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
