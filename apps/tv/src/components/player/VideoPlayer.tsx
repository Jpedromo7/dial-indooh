import { VideoView, useVideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { MediaOrientation, MediaRotation, ScreenOrientation } from "@dialindooh/shared";
import type { TvPlaylistItem } from "../../types/signage";
import { getPresentedMediaStyle, inferAutoRotationDegrees } from "./mediaPresentation";

const VIDEO_ADVANCE_EARLY_MS = 250;
const VIDEO_PROGRESS_INTERVAL_SECONDS = 0.5;

interface VideoPlayerProps {
  item: TvPlaylistItem;
  screenOrientation: ScreenOrientation;
  onAdvanceCue: () => void;
  onError: () => void;
}

export function VideoPlayer({ item, screenOrientation, onAdvanceCue, onError }: VideoPlayerProps) {
  const hasAdvancedRef = useRef(false);
  const [stageBounds, setStageBounds] = useState<{ width: number; height: number } | null>(null);
  const [autoRotationDegrees, setAutoRotationDegrees] = useState<MediaRotation>(0);
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
    setAutoRotationDegrees(0);
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
    const sourceLoadSubscription = player.addListener("sourceLoad", (payload) => {
      const videoTrack = payload.availableVideoTracks.find((track) => track.size.width > 0 && track.size.height > 0);
      setAutoRotationDegrees(inferAutoRotationDegrees(item.media.orientation, videoTrack?.size));
    });
    const trackSubscription = player.addListener("videoTrackChange", (payload) => {
      setAutoRotationDegrees(inferAutoRotationDegrees(item.media.orientation, payload.videoTrack?.size));
    });

    return () => {
      timeSubscription.remove();
      endSubscription.remove();
      statusSubscription.remove();
      sourceLoadSubscription.remove();
      trackSubscription.remove();
    };
  }, [advanceAtSeconds, item.media.orientation, onAdvanceCue, onError, player]);

  const rotationDegrees = item.media.rotationDegrees !== 0 ? item.media.rotationDegrees : autoRotationDegrees;

  return (
    <View style={styles.container}>
      <View
        onLayout={(event) => {
          const { height, width } = event.nativeEvent.layout;
          setStageBounds((current) =>
            current && current.width === width && current.height === height ? current : { width, height }
          );
        }}
        style={[styles.stage, getStageStyle(item.media.orientation, screenOrientation)]}
      >
        <VideoView
          contentFit="contain"
          fullscreenOptions={{ enable: false }}
          nativeControls={false}
          player={player}
          style={[styles.video, getPresentedMediaStyle(stageBounds, rotationDegrees)]}
          surfaceType="textureView"
        />
      </View>
    </View>
  );
}

function getStageStyle(orientation: MediaOrientation, screenOrientation: ScreenOrientation) {
  const effectiveOrientation = getEffectiveStageOrientation(orientation, screenOrientation);

  if (effectiveOrientation === "portrait") {
    return styles.portraitStage;
  }

  if (effectiveOrientation === "square") {
    return styles.squareStage;
  }

  return styles.fullStage;
}

function getEffectiveStageOrientation(orientation: MediaOrientation, screenOrientation: ScreenOrientation) {
  if (screenOrientation !== "portrait") {
    return orientation;
  }

  if (orientation === "portrait") {
    return "landscape";
  }

  if (orientation === "landscape") {
    return "portrait";
  }

  return orientation;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#000000",
    flex: 1,
    justifyContent: "center"
  },
  fullStage: {
    height: "100%",
    width: "100%"
  },
  portraitStage: {
    aspectRatio: 9 / 16,
    height: "100%"
  },
  squareStage: {
    aspectRatio: 1,
    height: "100%"
  },
  stage: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  video: {}
});
