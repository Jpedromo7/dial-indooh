import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { TvPlaylistItem } from "../../types/signage";

const VIDEO_ADVANCE_EARLY_MS = 250;
const VIDEO_PROGRESS_INTERVAL_SECONDS = 0.5;

interface VideoPlayerProps {
  item: TvPlaylistItem;
  onAdvanceCue: () => void;
  onError: () => void;
}

export function VideoPlayer({ item, onAdvanceCue, onError }: VideoPlayerProps) {
  const hasAdvancedRef = useRef(false);
  const sourceUri = item.media.localUri ?? item.media.fileUrl;
  const durationSeconds = item.media.durationSeconds ?? null;
  const advanceAtSeconds = durationSeconds ? Math.max(1, durationSeconds - VIDEO_ADVANCE_EARLY_MS / 1000) : null;
  const player = useVideoPlayer(
    {
      uri: sourceUri,
      metadata: {
        title: item.media.title
      }
    },
    (createdPlayer) => {
      createdPlayer.loop = true;
      createdPlayer.keepScreenOnWhilePlaying = true;
      createdPlayer.timeUpdateEventInterval = VIDEO_PROGRESS_INTERVAL_SECONDS;
      createdPlayer.play();
    }
  );

  useEffect(() => {
    hasAdvancedRef.current = false;
  }, [item.id, sourceUri]);

  useEffect(() => {
    player.play();
  }, [player]);

  useEffect(() => {
    const timeSubscription = player.addListener("timeUpdate", (payload) => {
      if (!advanceAtSeconds || hasAdvancedRef.current) {
        return;
      }

      if (payload.currentTime >= advanceAtSeconds) {
        hasAdvancedRef.current = true;
        onAdvanceCue();
      }
    });
    const endSubscription = player.addListener("playToEnd", () => {
      if (hasAdvancedRef.current) {
        return;
      }

      hasAdvancedRef.current = true;
      onAdvanceCue();
    });
    const statusSubscription = player.addListener("statusChange", (payload) => {
      if (payload.status === "error" && !hasAdvancedRef.current) {
        hasAdvancedRef.current = true;
        onError();
      }
    });

    return () => {
      timeSubscription.remove();
      endSubscription.remove();
      statusSubscription.remove();
    };
  }, [advanceAtSeconds, onAdvanceCue, onError, player]);

  return (
    <View style={styles.container}>
      <VideoView
        contentFit="contain"
        fullscreenOptions={{ enable: false }}
        nativeControls={false}
        player={player}
        style={styles.video}
        surfaceType="surfaceView"
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
