import { ResizeMode, Video } from "expo-av";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { TvPlaylistItem } from "../../types/signage";

interface VideoPlayerProps {
  item: TvPlaylistItem;
  onEnded: () => void;
  onError: () => void;
  shouldLoop?: boolean;
}

export function VideoPlayer({ item, onEnded, onError, shouldLoop = false }: VideoPlayerProps) {
  const hasFinishedRef = useRef(false);
  const sourceUri = item.media.localUri ?? item.media.fileUrl;

  const finishOnce = useCallback(() => {
    if (shouldLoop || hasFinishedRef.current) {
      return;
    }

    hasFinishedRef.current = true;
    onEnded();
  }, [onEnded, shouldLoop]);

  const errorOnce = useCallback(() => {
    if (hasFinishedRef.current) {
      return;
    }

    hasFinishedRef.current = true;
    onError();
  }, [onError]);

  useEffect(() => {
    hasFinishedRef.current = false;
  }, [item.id, sourceUri]);

  useEffect(() => {
    if (shouldLoop || !item.media.durationSeconds) {
      return undefined;
    }

    const timeout = setTimeout(finishOnce, (item.media.durationSeconds + 3) * 1000);
    return () => clearTimeout(timeout);
  }, [finishOnce, item.media.durationSeconds, shouldLoop]);

  return (
    <View style={styles.container}>
      <Video
        isLooping={shouldLoop}
        onError={errorOnce}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded && status.didJustFinish) {
            finishOnce();
          }
        }}
        progressUpdateIntervalMillis={500}
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
