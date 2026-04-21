import { ResizeMode, Video } from "expo-av";
import { StyleSheet, View } from "react-native";
import type { TvPlaylistItem } from "../../types/signage";

interface VideoPlayerProps {
  item: TvPlaylistItem;
  onEnded: () => void;
  onError: () => void;
}

export function VideoPlayer({ item, onEnded, onError }: VideoPlayerProps) {
  return (
    <View style={styles.container}>
      <Video
        isLooping={false}
        onError={onError}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded && status.didJustFinish) {
            onEnded();
          }
        }}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        source={{ uri: item.media.localUri ?? item.media.fileUrl }}
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
