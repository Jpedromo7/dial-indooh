import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type {
  ClockConfig,
  CurrencyConfig,
  InstagramConfig,
  NoticeConfig,
  RssConfig,
  WeatherConfig
} from "@dialindooh/shared";
import { getZonedNow } from "@dialindooh/shared";
import type { TvItem } from "../../types/signage";
import { PhotoBackground } from "./PhotoBackground";

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export const WEATHER_EMOJI: Record<string, string> = {
  sun: "☀️",
  "cloud-sun": "⛅",
  cloud: "☁️",
  fog: "🌫️",
  drizzle: "🌦️",
  rain: "🌧️",
  snow: "❄️",
  storm: "⛈️"
};

function useScale() {
  const { width, height } = useWindowDimensions();
  // Base 1080p deitado; a moldura vertical gira a tela, então usamos o menor lado.
  return Math.min(width, height) / 1080;
}

export function useClock(timezone: string, intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const zoned = getZonedNow(timezone, now);
  const hours = Math.floor(zoned.minutes / 60);
  const minutes = zoned.minutes % 60;
  const [year, month, day] = zoned.date.split("-");
  return {
    weekday: WEEKDAYS[zoned.weekday] ?? "",
    date: `${day}/${month}/${year}`,
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    seconds: String(now.getSeconds()).padStart(2, "0")
  };
}

function Frame({ background, image, children }: { background: string; image?: string | null; children: React.ReactNode }) {
  return (
    <View style={[styles.frame, { backgroundColor: background }]}>
      {image ? <PhotoBackground background={background} uri={image} /> : <View style={styles.glow} />}
      {children}
    </View>
  );
}

export function ClockWidget({ item, timezone }: { item: TvItem; timezone: string }) {
  const config = (item.config ?? {}) as ClockConfig;
  const scale = useScale();
  const clock = useClock(timezone);
  const color = config.color ?? "#ffffff";

  return (
    <Frame background={config.background ?? "#1d4ed8"} image={config.backgroundImageUrl}>
      <Text style={[styles.text, { color, fontSize: 52 * scale, fontWeight: "600" }]}>
        {clock.weekday}, {clock.date}
      </Text>
      <Text style={[styles.text, { color, fontSize: 260 * scale, fontWeight: "800", letterSpacing: 4 * scale }]}>
        {clock.time}
        <Text style={{ fontSize: 120 * scale, opacity: 0.85 }}>:{clock.seconds}</Text>
      </Text>
      {config.logoUrl ? (
        <View style={[styles.logoBox, { borderRadius: 16 * scale, padding: 18 * scale, marginTop: 30 * scale }]}>
          <Image resizeMode="contain" source={{ uri: config.logoUrl }} style={{ height: 150 * scale, width: 300 * scale }} />
        </View>
      ) : null}
    </Frame>
  );
}

export function CurrencyWidget({ item, timezone }: { item: TvItem; timezone: string }) {
  const config = (item.config ?? {}) as CurrencyConfig;
  const quotes = item.data?.quotes ?? [];
  const scale = useScale();
  const clock = useClock(timezone, 60_000);
  const color = config.color ?? "#ffffff";

  return (
    <Frame background={config.background ?? "#6d28d9"} image={config.backgroundImageUrl}>
      <Text style={[styles.text, { color, fontSize: 64 * scale, fontWeight: "800", marginBottom: 40 * scale }]}>Cotação em {clock.date}</Text>
      <View style={[styles.row, { gap: 32 * scale }]}>
        {quotes.map((quote) => (
          <View key={quote.code} style={[styles.card, { borderRadius: 28 * scale, paddingHorizontal: 48 * scale, paddingVertical: 32 * scale }]}>
            <Text style={[styles.text, { color, fontSize: 40 * scale, fontWeight: "700" }]}>
              {quote.name} ({quote.code})
            </Text>
            <Text style={[styles.text, { color, fontSize: 110 * scale, fontWeight: "900" }]}>
              R$ {formatMoney(quote.bid, quote.code === "BTC" ? 0 : 2)}
            </Text>
            <Text style={[styles.text, { color: quote.pctChange >= 0 ? "#bbf7d0" : "#fecaca", fontSize: 36 * scale, fontWeight: "700" }]}>
              {quote.pctChange >= 0 ? "▲" : "▼"} {Math.abs(quote.pctChange).toFixed(2).replace(".", ",")}%
            </Text>
          </View>
        ))}
      </View>
    </Frame>
  );
}

export function WeatherWidget({ item }: { item: TvItem }) {
  const config = (item.config ?? {}) as WeatherConfig;
  const weather = item.data?.weather;
  const scale = useScale();
  const color = config.color ?? "#ffffff";

  if (!weather) {
    return (
      <Frame background={config.background ?? "#0369a1"} image={config.backgroundImageUrl}>
        <Text style={[styles.text, { color, fontSize: 48 * scale }]}>Previsão indisponível</Text>
      </Frame>
    );
  }

  return (
    <Frame background={config.background ?? "#0369a1"} image={config.backgroundImageUrl}>
      <Text style={[styles.text, { color, fontSize: 70 * scale, fontWeight: "800" }]}>{weather.city}</Text>
      <View style={[styles.row, { gap: 30 * scale }]}>
        <Text style={{ fontSize: 200 * scale }}>{WEATHER_EMOJI[weather.icon] ?? "⛅"}</Text>
        <Text style={[styles.text, { color, fontSize: 260 * scale, fontWeight: "900" }]}>{weather.temperature}°</Text>
      </View>
      <Text style={[styles.text, { color, fontSize: 52 * scale, fontWeight: "600" }]}>{weather.description}</Text>
      <Text style={[styles.text, { color, fontSize: 40 * scale, opacity: 0.85 }]}>
        Máx {weather.max}° · Mín {weather.min}°
      </Text>
      {weather.forecast?.length ? (
        <View style={[styles.row, { gap: 24 * scale, marginTop: 36 * scale }]}>
          {weather.forecast.map((day) => (
            <View key={day.date} style={[styles.card, { borderRadius: 20 * scale, paddingHorizontal: 34 * scale, paddingVertical: 18 * scale }]}>
              <Text style={[styles.text, { color, fontSize: 34 * scale, fontWeight: "700" }]}>
                {WEEKDAYS[new Date(`${day.date}T12:00:00`).getDay()]?.slice(0, 3)}
              </Text>
              <Text style={{ fontSize: 56 * scale, textAlign: "center" }}>{WEATHER_EMOJI[day.icon] ?? "⛅"}</Text>
              <Text style={[styles.text, { color, fontSize: 32 * scale }]}>
                {day.max}° / {day.min}°
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Frame>
  );
}

export function RssWidget({ item, portrait }: { item: TvItem; portrait: boolean }) {
  const config = (item.config ?? {}) as RssConfig;
  const items = item.data?.rss ?? [];
  const scale = useScale();
  const color = config.color ?? "#ffffff";
  const [index, setIndex] = useState(0);
  const perItemMs = Math.max(5000, (item.durationSeconds * 1000) / Math.max(1, items.length));

  useEffect(() => {
    setIndex(0);
    if (items.length < 2) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % items.length), perItemMs);
    return () => clearInterval(timer);
  }, [items.length, perItemMs]);

  const news = items[index];

  if (!news) {
    return <Frame background={config.background ?? "#111827"} image={config.backgroundImageUrl}>{null}</Frame>;
  }

  return (
    <View style={[styles.rss, { backgroundColor: config.background ?? "#111827", flexDirection: portrait ? "column" : "row" }]}>
      {news.imageUrl ?? config.backgroundImageUrl ? (
        <Image resizeMode="cover" source={{ uri: (news.imageUrl ?? config.backgroundImageUrl) as string }} style={portrait ? styles.rssImagePortrait : styles.rssImage} />
      ) : null}
      <View style={[styles.rssText, { padding: 60 * scale, gap: 24 * scale }]}>
        <View style={[styles.row, { gap: 18 * scale, justifyContent: "flex-start" }]}>
          {config.logoUrl ? <Image resizeMode="contain" source={{ uri: config.logoUrl }} style={{ height: 60 * scale, width: 160 * scale }} /> : null}
          <Text style={[styles.left, { color, fontSize: 34 * scale, fontWeight: "800", opacity: 0.85, textTransform: "uppercase" }]}>
            {config.source || "Notícias"}
          </Text>
        </View>
        <Text numberOfLines={5} style={[styles.left, { color, fontSize: 72 * scale, fontWeight: "900", lineHeight: 84 * scale }]}>
          {news.title}
        </Text>
        {news.description ? (
          <Text numberOfLines={4} style={[styles.left, { color, fontSize: 38 * scale, lineHeight: 50 * scale, opacity: 0.9 }]}>
            {news.description}
          </Text>
        ) : null}
        {items.length > 1 ? (
          <View style={[styles.row, { gap: 10 * scale, justifyContent: "flex-start" }]}>
            {items.map((entry, position) => (
              <View
                key={`${entry.title}-${position}`}
                style={{ backgroundColor: color, borderRadius: 8 * scale, height: 12 * scale, opacity: position === index ? 1 : 0.3, width: (position === index ? 48 : 12) * scale }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function NoticeWidget({ item }: { item: TvItem }) {
  const config = (item.config ?? {}) as NoticeConfig;
  const scale = useScale();
  const color = config.color ?? "#ffffff";

  return (
    <Frame background={config.background ?? "#b91c1c"} image={config.backgroundImageUrl}>
      {config.imageUrl ? <Image resizeMode="contain" source={{ uri: config.imageUrl }} style={{ height: 300 * scale, marginBottom: 40 * scale, width: 600 * scale }} /> : null}
      <Text style={[styles.text, { color, fontSize: 110 * scale, fontWeight: "900", lineHeight: 124 * scale, paddingHorizontal: 80 * scale }]}>
        {config.text}
      </Text>
      {config.subtitle ? (
        <Text style={[styles.text, { color, fontSize: 52 * scale, marginTop: 30 * scale, opacity: 0.9, paddingHorizontal: 80 * scale }]}>{config.subtitle}</Text>
      ) : null}
    </Frame>
  );
}

export function InstagramWidget({ item, portrait }: { item: TvItem; portrait: boolean }) {
  const config = (item.config ?? {}) as InstagramConfig;
  const posts = item.data?.posts ?? [];
  const scale = useScale();
  const color = config.color ?? "#ffffff";
  const single = posts.length === 1 || portrait;
  const shown = portrait ? posts.slice(0, 1) : posts;

  return (
    <Frame background={config.background ?? "#111827"}>
      <View style={[styles.row, { gap: 20 * scale, marginBottom: 30 * scale }]}>
        {config.profileImageUrl ? (
          <Image source={{ uri: config.profileImageUrl }} style={{ borderRadius: 50 * scale, height: 90 * scale, width: 90 * scale }} />
        ) : null}
        <Text style={[styles.text, { color, fontSize: 56 * scale, fontWeight: "800" }]}>@{config.username ?? "instagram"}</Text>
      </View>
      <View style={[styles.row, { gap: 30 * scale }]}>
        {shown.map((post) => (
          <View key={post.id} style={{ alignItems: "center", width: single ? 760 * scale : 520 * scale }}>
            <Image resizeMode="cover" source={{ uri: post.imageUrl }} style={{ aspectRatio: 1, borderRadius: 24 * scale, width: "100%" }} />
            {single && post.caption ? (
              <Text numberOfLines={2} style={[styles.text, { color, fontSize: 34 * scale, marginTop: 20 * scale }]}>
                {post.caption}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </Frame>
  );
}

function formatMoney(value: number, decimals: number) {
  return value.toFixed(decimals).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  frame: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden"
  },
  glow: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 9999,
    height: "120%",
    left: "-30%",
    position: "absolute",
    top: "-60%",
    width: "90%"
  },
  left: {
    textAlign: "left"
  },
  logoBox: {
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center"
  },
  rss: {
    flex: 1
  },
  rssImage: {
    height: "100%",
    width: "50%"
  },
  rssImagePortrait: {
    height: "45%",
    width: "100%"
  },
  rssText: {
    flex: 1,
    justifyContent: "center"
  },
  text: {
    textAlign: "center"
  }
});
