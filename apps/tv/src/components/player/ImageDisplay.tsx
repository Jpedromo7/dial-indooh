import { Image, StyleSheet, View } from "react-native";
import type { MediaOrientation } from "@dialindooh/shared";
import type { TvPlaylistItem } from "../../types/signage";

interface ImageDisplayProps {
  item: TvPlaylistItem;
  onError: () => void;
}

export function ImageDisplay({ item, onError }: ImageDisplayProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.stage, getStageStyle(item.media.orientation)]}>
        <Image
          onError={onError}
          resizeMode="contain"
          source={{ uri: item.media.localUri ?? item.media.fileUrl }}
          style={styles.image}
        />
      </View>
    </View>
  );
}

function getStageStyle(orientation: MediaOrientation) {
  if (orientation === "portrait") {
    return styles.portraitStage;
  }

  if (orientation === "square") {
    return styles.squareStage;
  }

  return styles.fullStage;
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
  image: {
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
    justifyContent: "center"
  }
});
