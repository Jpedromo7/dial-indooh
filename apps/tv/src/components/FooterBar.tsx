import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { TvManifest } from "../types/signage";
import { useClock, WEATHER_EMOJI } from "./widgets/Widgets";

type Footer = NonNullable<TvManifest["footer"]>;

const SPEED_PX_PER_SECOND = { slow: 60, normal: 110, fast: 180 };

/** Barra de rodapé: logo, frase/manchetes rolando, clima, data e hora. */
export function FooterBar({ footer, timezone, height }: { footer: Footer; timezone: string; height: number }) {
  const clock = useClock(timezone, 15_000);
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(width)).current;
  const [textWidth, setTextWidth] = useState(0);
  const [trackWidth, setTrackWidth] = useState(width);
  const text = footer.headlines.length ? footer.headlines.join("     •     ") : footer.phrase;
  const fontSize = Math.round(height * 0.42);
  const showTicker = footer.showPhrase && Boolean(text);

  useEffect(() => {
    if (!showTicker || textWidth === 0) return undefined;

    const distance = trackWidth + textWidth;
    const duration = (distance / SPEED_PX_PER_SECOND[footer.speed]) * 1000;
    translateX.setValue(trackWidth);
    const animation = Animated.loop(
      Animated.timing(translateX, { toValue: -textWidth, duration, easing: Easing.linear, useNativeDriver: true })
    );
    animation.start();
    return () => animation.stop();
  }, [footer.speed, showTicker, text, textWidth, trackWidth, translateX]);

  return (
    <View style={[styles.bar, { backgroundColor: footer.background, height, paddingHorizontal: height * 0.3, gap: height * 0.35 }]}>
      {footer.logoUrl ? <Image resizeMode="contain" source={{ uri: footer.logoUrl }} style={{ height: height * 0.8, width: height * 1.8 }} /> : null}
      <View onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)} style={styles.track}>
        {showTicker ? (
          <ScrollView
            contentContainerStyle={styles.tickerContent}
            horizontal
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
          >
            <Animated.View onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)} style={{ transform: [{ translateX }] }}>
              <Text numberOfLines={1} style={[styles.ticker, { color: footer.color, fontSize }]}>
                {text}
              </Text>
            </Animated.View>
          </ScrollView>
        ) : null}
      </View>
      {footer.showWeather && footer.weather ? (
        <Text style={[styles.info, { color: footer.color, fontSize }]}>
          {footer.showIcons ? `${WEATHER_EMOJI[footer.weather.icon] ?? "⛅"} ` : ""}
          {footer.weather.temperature}°
        </Text>
      ) : null}
      {footer.showDate ? (
        <Text style={[styles.info, { color: footer.color, fontSize: fontSize * 0.9 }]}>
          {footer.showIcons ? "📅 " : ""}
          {clock.date.slice(0, 5)}
        </Text>
      ) : null}
      {footer.showTime ? (
        <Text style={[styles.info, styles.time, { color: footer.color, fontSize }]}>
          {footer.showIcons ? "🕒 " : ""}
          {clock.time}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    flexDirection: "row",
    width: "100%"
  },
  info: {
    fontWeight: "700"
  },
  ticker: {
    fontWeight: "600"
  },
  tickerContent: {
    alignItems: "center"
  },
  time: {
    fontVariant: ["tabular-nums"]
  },
  track: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    overflow: "hidden"
  }
});
