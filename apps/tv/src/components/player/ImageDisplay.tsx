import { Image, StyleSheet, View } from "react-native";
import type { MediaOrientation, MediaRotation, ScreenOrientation } from "@dialindooh/shared";
import { useEffect, useState } from "react";
import type { TvPlaylistItem } from "../../types/signage";
import { getPresentedMediaStyle, inferAutoRotationDegrees } from "./mediaPresentation";

interface ImageDisplayProps {
  item: TvPlaylistItem;
  screenOrientation: ScreenOrientation;
  onError: () => void;
}

export function ImageDisplay({ item, screenOrientation, onError }: ImageDisplayProps) {
  const [stageBounds, setStageBounds] = useState<{ width: number; height: number } | null>(null);
  const [autoRotationDegrees, setAutoRotationDegrees] = useState<MediaRotation>(0);
  const sourceUri = item.media.localUri ?? item.media.fileUrl;

  useEffect(() => {
    setAutoRotationDegrees(0);
    Image.getSize(
      sourceUri,
      (width, height) => {
        setAutoRotationDegrees(inferAutoRotationDegrees(item.media.orientation, { width, height }));
      },
      () => {
        setAutoRotationDegrees(0);
      }
    );
  }, [item.media.orientation, sourceUri]);

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
        <Image
          onError={onError}
          // Decodifica no tamanho da tela, não no tamanho original (fotos grandes travavam boxes com pouca RAM).
          resizeMethod="resize"
          resizeMode="contain"
          source={{ uri: sourceUri }}
          style={[styles.image, getPresentedMediaStyle(stageBounds, rotationDegrees)]}
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
  image: {},
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
  }
});
