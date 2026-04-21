import { Image, StyleSheet, View } from "react-native";
import type { TvPlaylistItem } from "../../types/signage";

interface ImageDisplayProps {
  item: TvPlaylistItem;
  onError: () => void;
}

export function ImageDisplay({ item, onError }: ImageDisplayProps) {
  return (
    <View style={styles.container}>
      <Image
        onError={onError}
        resizeMode="contain"
        source={{ uri: item.media.localUri ?? item.media.fileUrl }}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#000000",
    flex: 1,
    justifyContent: "center"
  },
  image: {
    height: "100%",
    width: "100%"
  }
});
