import { ResizeMode, Video } from "expo-av";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { TvPlaylistItem } from "../../types/signage";

const VIDEO_FALLBACK_DURATION_SECONDS = 30;
const DECODER_RELEASE_DELAY_MS = 180;

interface VideoPlayerProps {
  item: TvPlaylistItem;
  onEnded: () => void;
  onError: () => void;
  shouldLoop?: boolean;
}

export function VideoPlayer({ item, onEnded, onError, shouldLoop = false }: VideoPlayerProps) {
  const hasFinishedRef = useRef(false);
  const videoRef = useRef<Video>(null);
  const sourceUri = item.media.localUri ?? item.media.fileUrl;

  const finishOnce = useCallback(() => {
    if (shouldLoop || hasFinishedRef.current) {
      return;
    }

    hasFinishedRef.current = true;
    void releaseDecoderThen(onEnded);
  }, [onEnded, shouldLoop]);

  const errorOnce = useCallback(() => {
    if (hasFinishedRef.current) {
      return;
    }

    hasFinishedRef.current = true;
    void releaseDecoderThen(onError);
  }, [onError]);

  useEffect(() => {
    hasFinishedRef.current = false;
  }, [item.id, sourceUri]);

  useEffect(() => {
    if (shouldLoop) {
      return undefined;
    }

    const durationSeconds = item.media.durationSeconds ?? VIDEO_FALLBACK_DURATION_SECONDS;
    const timeout = setTimeout(finishOnce, durationSeconds * 1000);
    return () => clearTimeout(timeout);
  }, [finishOnce, item.media.durationSeconds, shouldLoop]);

  async function releaseDecoderThen(callback: () => void) {
    try {
      await videoRef.current?.pauseAsync();
      await videoRef.current?.unloadAsync();
    } catch {
      // Some Android TV firmware rejects unload during decoder transitions.
    }

    setTimeout(callback, DECODER_RELEASE_DELAY_MS);
  }

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        isLooping
        onError={errorOnce}
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
