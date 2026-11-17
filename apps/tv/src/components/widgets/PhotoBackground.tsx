import { Image, StyleSheet, View } from "react-native";

/** Foto de fundo dos conteúdos dinâmicos, com a cor do conteúdo por cima para o texto continuar legível (mesma receita da prévia do painel). */
export function PhotoBackground({ uri, background }: { uri: string; background: string }) {
  return (
    <>
      <Image fadeDuration={0} resizeMethod="resize" resizeMode="cover" source={{ uri }} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: background, opacity: 0.6 }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.25)" }]} />
    </>
  );
}
