import { ResizeMode, Video } from "expo-av";
import { StyleSheet, View } from "react-native";
import type { TvPlaylistItem } from "../../types/signage";

interface VideoPlayerProps {
  item: TvPlaylistItem;
  onError: () => void;
}

export function VideoPlayer({ item, onError }: VideoPlayerProps) {
  const sourceUri = item.media.localUri ?? item.media.fileUrl;

  return (
    <View style={styles.container}>
      <Video
        isLooping
        onError={onError}
        progressUpdateIntervalMillis={1000}
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
