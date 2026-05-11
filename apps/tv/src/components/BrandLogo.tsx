import { Image, StyleSheet, View } from "react-native";

const logoSource = require("../../assets/dial-indooh-logo.png");

interface BrandLogoProps {
  size?: number;
}

export function BrandLogo({ size = 88 }: BrandLogoProps) {
  return (
    <View style={[styles.logoShell, { borderRadius: Math.max(8, size * 0.16), height: size, width: size }]}>
      <Image resizeMode="contain" source={logoSource} style={styles.logoImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  logoImage: {
    height: "100%",
    width: "100%"
  },
  logoShell: {
    backgroundColor: "#071312",
    borderColor: "#153b37",
    borderWidth: 1,
    overflow: "hidden"
  }
});
