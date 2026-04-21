import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Preparing player" }: LoadingScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>D</Text>
      </View>
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
  logo: {
    alignItems: "center",
    backgroundColor: "#22c7aa",
    borderRadius: 8,
    height: 72,
    justifyContent: "center",
    width: 72
  },
  logoText: {
    color: "#001411",
    fontSize: 38,
    fontWeight: "900"
  },
  caption: {
    color: "#7d8798",
    fontSize: 18
  }
});
