import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { getZonedNow, type BirthdaysConfig, type CountdownConfig, type HolidaysConfig, type QrCodeConfig, type QuoteConfig } from "@dialindooh/shared";
import type { TvItem } from "../../types/signage";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function useScale() {
  const { width, height } = useWindowDimensions();
  return Math.min(width, height) / 1080;
}

function Frame({ background, children }: { background: string; children: React.ReactNode }) {
  return (
    <View style={[styles.frame, { backgroundColor: background }]}>
      <View style={styles.glow} />
      {children}
    </View>
  );
}

export function QuoteWidget({ item }: { item: TvItem }) {
  const config = (item.config ?? {}) as QuoteConfig;
  const scale = useScale();
  const color = config.color ?? "#ffffff";
  const text = item.data?.quote?.text ?? "";

  return (
    <Frame background={config.background ?? "#0f766e"}>
      <Text style={[styles.text, { color, fontSize: 44 * scale, fontWeight: "800", letterSpacing: 6 * scale, opacity: 0.85, textTransform: "uppercase" }]}>
        {config.title || "Frase do dia"}
      </Text>
      <Text style={[styles.text, { color, fontSize: 200 * scale, lineHeight: 160 * scale, opacity: 0.35 }]}>“</Text>
      <Text style={[styles.text, { color, fontSize: 82 * scale, fontWeight: "800", lineHeight: 104 * scale, paddingHorizontal: 140 * scale }]}>
        {text}
      </Text>
    </Frame>
  );
}

export function CountdownWidget({ item }: { item: TvItem }) {
  const config = (item.config ?? {}) as CountdownConfig;
  const scale = useScale();
  const color = config.color ?? "#ffffff";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diff = Math.max(0, new Date(config.target).getTime() - now);
  const parts: Array<[number, string]> = [
    [Math.floor(diff / 86_400_000), "dias"],
    [Math.floor((diff % 86_400_000) / 3_600_000), "horas"],
    [Math.floor((diff % 3_600_000) / 60_000), "minutos"],
    [Math.floor((diff % 60_000) / 1000), "segundos"]
  ];

  return (
    <Frame background={config.background ?? "#be123c"}>
      {config.imageUrl ? <Image resizeMode="contain" source={{ uri: config.imageUrl }} style={{ height: 220 * scale, marginBottom: 30 * scale, width: 500 * scale }} /> : null}
      <Text style={[styles.text, { color, fontSize: 80 * scale, fontWeight: "900", marginBottom: 50 * scale }]}>{config.title}</Text>
      {diff === 0 ? (
        <Text style={[styles.text, { color, fontSize: 120 * scale, fontWeight: "900" }]}>{config.finishedText || "Chegou o grande dia!"}</Text>
      ) : (
        <View style={[styles.row, { gap: 36 * scale }]}>
          {parts.map(([value, label]) => (
            <View key={label} style={[styles.card, { borderRadius: 28 * scale, minWidth: 250 * scale, paddingVertical: 30 * scale }]}>
              <Text style={[styles.text, { color, fontSize: 150 * scale, fontVariant: ["tabular-nums"], fontWeight: "900" }]}>
                {String(value).padStart(2, "0")}
              </Text>
              <Text style={[styles.text, { color, fontSize: 36 * scale, fontWeight: "700", opacity: 0.85, textTransform: "uppercase" }]}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </Frame>
  );
}

export function HolidaysWidget({ item }: { item: TvItem }) {
  const config = (item.config ?? {}) as HolidaysConfig;
  const scale = useScale();
  const color = config.color ?? "#ffffff";
  const holidays = item.data?.holidays ?? [];

  return (
    <Frame background={config.background ?? "#15803d"}>
      <Text style={[styles.text, { color, fontSize: 80 * scale, fontWeight: "900", marginBottom: 40 * scale }]}>{config.title || "Próximos feriados"}</Text>
      <View style={{ gap: 22 * scale, width: "80%" }}>
        {holidays.map((holiday) => (
          <View key={holiday.date} style={[styles.listRow, { borderRadius: 24 * scale, paddingHorizontal: 40 * scale, paddingVertical: 22 * scale }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color, fontSize: 52 * scale, fontWeight: "800" }}>{holiday.name}</Text>
              <Text style={{ color, fontSize: 34 * scale, opacity: 0.85 }}>
                {holiday.date.slice(8, 10)}/{holiday.date.slice(5, 7)} · {holiday.weekday}
              </Text>
            </View>
            <Text style={{ color, fontSize: 44 * scale, fontWeight: "900" }}>
              {holiday.daysUntil === 0 ? "Hoje" : holiday.daysUntil === 1 ? "Amanhã" : `em ${holiday.daysUntil} dias`}
            </Text>
          </View>
        ))}
      </View>
    </Frame>
  );
}

export function BirthdaysWidget({ item, timezone }: { item: TvItem; timezone: string }) {
  const config = (item.config ?? {}) as BirthdaysConfig;
  const scale = useScale();
  const color = config.color ?? "#ffffff";
  const today = getZonedNow(timezone);
  const month = Number(today.date.slice(5, 7));
  const day = Number(today.date.slice(8, 10));
  const people = (config.people ?? []).filter((person) => person.month === month).sort((left, right) => left.day - right.day);
  const columns = people.length > 6 ? 3 : people.length > 3 ? 2 : 1;

  return (
    <Frame background={config.background ?? "#c026d3"}>
      <Text style={{ fontSize: 110 * scale }}>🎉</Text>
      <Text style={[styles.text, { color, fontSize: 76 * scale, fontWeight: "900", marginBottom: 40 * scale }]}>
        {config.title || `Aniversariantes de ${MONTHS[month - 1]}`}
      </Text>
      <View style={[styles.wrap, { gap: 20 * scale, width: "88%" }]}>
        {people.slice(0, 18).map((person) => {
          const isToday = person.day === day;
          return (
            <View
              key={`${person.name}-${person.day}`}
              style={[
                styles.card,
                {
                  borderRadius: 22 * scale,
                  borderWidth: isToday ? 4 * scale : 0,
                  borderColor: color,
                  paddingHorizontal: 24 * scale,
                  paddingVertical: 16 * scale,
                  width: `${Math.floor(100 / columns) - 2}%`
                }
              ]}
            >
              <Text numberOfLines={1} style={{ color, fontSize: 44 * scale, fontWeight: "800" }}>
                {isToday ? "🎂 " : ""}
                {person.name}
              </Text>
              <Text numberOfLines={1} style={{ color, fontSize: 30 * scale, opacity: 0.85 }}>
                {isToday ? "Hoje!" : `Dia ${person.day}`}
                {person.role ? ` · ${person.role}` : ""}
              </Text>
            </View>
          );
        })}
      </View>
    </Frame>
  );
}

export function QrCodeWidget({ item, portrait }: { item: TvItem; portrait: boolean }) {
  const config = (item.config ?? {}) as QrCodeConfig;
  const scale = useScale();
  const color = config.color ?? "#ffffff";
  const image = item.data?.qrImage;

  return (
    <Frame background={config.background ?? "#1e293b"}>
      <View style={[portrait ? styles.column : styles.row, { gap: 80 * scale, paddingHorizontal: 100 * scale }]}>
        <View style={{ backgroundColor: "#ffffff", borderRadius: 36 * scale, padding: 30 * scale }}>
          {image ? <Image source={{ uri: image }} style={{ height: 560 * scale, width: 560 * scale }} /> : null}
        </View>
        <View style={{ flexShrink: 1, maxWidth: portrait ? "100%" : 900 * scale }}>
          <Text style={[portrait ? styles.text : styles.left, { color, fontSize: 92 * scale, fontWeight: "900", lineHeight: 108 * scale }]}>{config.title}</Text>
          {config.subtitle ? (
            <Text style={[portrait ? styles.text : styles.left, { color, fontSize: 50 * scale, marginTop: 24 * scale, opacity: 0.9 }]}>{config.subtitle}</Text>
          ) : null}
          {config.kind === "wifi" ? (
            <Text style={[portrait ? styles.text : styles.left, { color, fontSize: 40 * scale, marginTop: 24 * scale, opacity: 0.85 }]}>
              Rede: {config.value}
              {config.wifiPassword ? `  ·  Senha: ${config.wifiPassword}` : ""}
            </Text>
          ) : null}
        </View>
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  column: {
    alignItems: "center",
    flexDirection: "column"
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
  listRow: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    flexDirection: "row"
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center"
  },
  text: {
    textAlign: "center"
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center"
  }
});
