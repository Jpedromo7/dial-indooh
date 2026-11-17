import { Image, StyleSheet } from "react-native";

// Símbolo D Player (fundo transparente), gerado por scripts/brand/generate-brand-assets.mjs.
const logoSource = require("../../assets/d-player-symbol.png");

interface BrandLogoProps {
  size?: number;
}

export function BrandLogo({ size = 88 }: BrandLogoProps) {
  return <Image accessibilityLabel="D Player" resizeMode="contain" source={logoSource} style={[styles.logo, { height: size, width: size }]} />;
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: "transparent"
  }
});
