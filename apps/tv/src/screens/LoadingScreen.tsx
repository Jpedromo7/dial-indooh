import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Preparing player" }: LoadingScreenProps) {
  return (
    <View style={styles.screen}>
      <BrandLogo size={92} />
      <ActivityIndicator color="#22c7aa" size="large" />
      <Text style={styles.caption}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: "#000000",
    flex: 1,
    gap: 18,
    justifyContent: "center"
  },
  caption: {
    color: "#7d8798",
    fontSize: 18
  }
});
