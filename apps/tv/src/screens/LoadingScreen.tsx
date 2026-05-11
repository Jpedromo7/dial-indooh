import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Preparando reprodutor" }: LoadingScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBand} />
      <View style={styles.panel}>
        <BrandLogo size={112} />
        <View style={styles.copyBlock}>
          <Text style={styles.brand}>Dial indoor TV</Text>
          <Text style={styles.caption}>{message}</Text>
        </View>
        <ActivityIndicator color="#22c7aa" size="large" />
      </View>
      <Text style={styles.footer}>Reprodução automática</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: "#f8fafc",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 0
  },
  screen: {
    alignItems: "center",
    backgroundColor: "#060910",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  caption: {
    color: "#a8b3c7",
    fontSize: 20,
    lineHeight: 28,
    textAlign: "center"
  },
  copyBlock: {
    alignItems: "center",
    gap: 8
  },
  footer: {
    bottom: 34,
    color: "#506177",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0,
    position: "absolute",
    textTransform: "uppercase"
  },
  panel: {
    alignItems: "center",
    backgroundColor: "#0c1320",
    borderColor: "#22314a",
    borderRadius: 8,
    borderWidth: 1,
    gap: 24,
    minWidth: 560,
    paddingHorizontal: 64,
    paddingVertical: 48
  },
  topBand: {
    backgroundColor: "#22c7aa",
    height: 5,
    left: 0,
    opacity: 0.9,
    position: "absolute",
    right: 0,
    top: 0
  }
});
