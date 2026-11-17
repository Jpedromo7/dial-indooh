import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "../components/BrandLogo";
import { BRAND_NAME, brandColors } from "../theme/brand";

interface LoadingScreenProps {
  message?: string;
  splashUrl?: string | null;
}

export function LoadingScreen({ message = "Preparando reprodutor", splashUrl }: LoadingScreenProps) {
  if (splashUrl) {
    return (
      <View style={styles.screen}>
        <Image resizeMode="contain" source={{ uri: splashUrl }} style={styles.splash} />
        <ActivityIndicator color="#ffffff" size="large" style={styles.splashSpinner} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBand} />
      <View style={styles.panel}>
        <BrandLogo size={112} />
        <View style={styles.copyBlock}>
          <Text style={styles.brand}>{BRAND_NAME}</Text>
          <Text style={styles.caption}>{message}</Text>
        </View>
        <ActivityIndicator color={brandColors.cyan} size="large" />
      </View>
      <Text style={styles.footer}>Reprodução automática</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    height: "60%",
    width: "60%"
  },
  splashSpinner: {
    bottom: 48,
    position: "absolute"
  },
  brand: {
    color: brandColors.text,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0
  },
  screen: {
    alignItems: "center",
    backgroundColor: brandColors.background,
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  caption: {
    color: brandColors.textMuted,
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
    backgroundColor: brandColors.surface,
    borderColor: brandColors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 24,
    minWidth: 560,
    paddingHorizontal: 64,
    paddingVertical: 48
  },
  topBand: {
    backgroundColor: brandColors.blue,
    height: 4,
    left: 0,
    opacity: 0.8,
    position: "absolute",
    right: 0,
    top: 0
  }
});
