import { ResizeMode, Video } from "expo-av";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { TvPlaylistItem } from "../../types/signage";

const VIDEO_ADVANCE_EARLY_MS = 2500;
const VIDEO_PROGRESS_INTERVAL_MS = 500;

interface VideoPlayerProps {
  item: TvPlaylistItem;
  onAdvanceCue: () => void;
  onError: () => void;
}

export function VideoPlayer({ item, onAdvanceCue, onError }: VideoPlayerProps) {
  const hasAdvancedRef = useRef(false);
  const sourceUri = item.media.localUri ?? item.media.fileUrl;
  const durationMs = item.media.durationSeconds ? item.media.durationSeconds * 1000 : null;
  const advanceAtMs = durationMs ? Math.max(1000, durationMs - VIDEO_ADVANCE_EARLY_MS) : null;

  useEffect(() => {
    hasAdvancedRef.current = false;
  }, [item.id, sourceUri]);

  return (
    <View style={styles.container}>
      <Video
        isLooping
        onError={onError}
        onPlaybackStatusUpdate={(status) => {
          if (!status.isLoaded || !advanceAtMs || hasAdvancedRef.current) {
            return;
          }

          if (status.positionMillis >= advanceAtMs) {
            hasAdvancedRef.current = true;
            onAdvanceCue();
          }
        }}
        progressUpdateIntervalMillis={VIDEO_PROGRESS_INTERVAL_MS}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        source={{ uri: sourceUri }}
        style={styles.video}
        useNativeControls={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
    flex: 1
  },
  video: {
    height: "100%",
    width: "100%"
  }
});
