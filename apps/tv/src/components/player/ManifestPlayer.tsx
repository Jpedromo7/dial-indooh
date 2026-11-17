import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { getZonedNow, isScheduleActive, type ScreenOrientation } from "@dialindooh/shared";
import { deleteCachedFile } from "../../services/manifestSync";
import { recordPlay } from "../../services/playLog";
import type { PlaybackStatus, RemoteKeyCommand, TvItem, TvPlaylistItem } from "../../types/signage";
import { ClockWidget, CurrencyWidget, InstagramWidget, NoticeWidget, RssWidget, WeatherWidget } from "../widgets/Widgets";
import { WebContent } from "../widgets/WebContent";
import { BirthdaysWidget, CountdownWidget, HolidaysWidget, QrCodeWidget, QuoteWidget } from "../widgets/ExtraWidgets";
import { ImageDisplay } from "./ImageDisplay";
import { VideoPlayer } from "./VideoPlayer";

const IDLE_RECHECK_MS = 30_000;
const VIDEO_SAFETY_EXTRA_MS = 8_000;

interface ManifestPlayerProps {
  items: TvItem[];
  manifestVersion: string;
  orientation: ScreenOrientation;
  timezone: string;
  muted: boolean;
  shuffle: boolean;
  remoteKeyCommand: RemoteKeyCommand | null;
  onStatusChange: (status: PlaybackStatus) => void;
  onError: (item: TvItem, message: string) => void;
  idle: React.ReactNode;
}

export function ManifestPlayer({
  items,
  manifestVersion,
  orientation,
  timezone,
  muted,
  shuffle,
  remoteKeyCommand,
  onStatusChange,
  onError,
  idle
}: ManifestPlayerProps) {
  const [order, setOrder] = useState<TvItem[]>(() => (shuffle ? shuffled(items) : items));
  const [current, setCurrent] = useState<{ item: TvItem; position: number; cycle: number } | null>(null);
  const failedRef = useRef<Set<string>>(new Set());
  const startedAtRef = useRef<number>(Date.now());
  const handledRemoteRef = useRef<string | null>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  const playCounterRef = useRef(0);

  const isPlayable = useCallback(
    (item: TvItem) => !failedRef.current.has(item.key) && isScheduleActive(item.schedule, getZonedNow(timezone)),
    [timezone]
  );

  /** Procura o próximo item que pode tocar agora, a partir de uma posição. */
  const findFrom = useCallback(
    (list: TvItem[], start: number, step: 1 | -1) => {
      for (let offset = 0; offset < list.length; offset += 1) {
        const position = (start + offset * step + list.length * 2) % list.length;
        const item = list[position];
        if (item && isPlayable(item)) return { item, position };
      }
      return null;
    },
    [isPlayable]
  );

  const finishCurrent = useCallback(() => {
    if (!current) return;
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
    if (current.item.recordStats && elapsed >= Math.min(3, current.item.durationSeconds)) {
      void recordPlay({
        mediaId: current.item.mediaId,
        playlistId: current.item.playlistId,
        startedAt: new Date(startedAtRef.current).toISOString(),
        durationSeconds: elapsed
      });
    }
  }, [current]);

  const goTo = useCallback(
    (step: 1 | -1) => {
      finishCurrent();
      let list = order;
      let start = current ? current.position + step : 0;

      // Fim da volta: em modo aleatório, sorteia uma nova ordem.
      if (current && step === 1 && current.position + 1 >= order.length && shuffle) {
        list = shuffled(items);
        setOrder(list);
        start = 0;
      }

      const next = findFrom(list, start, step);
      playCounterRef.current += 1;
      setCurrent(next ? { ...next, cycle: playCounterRef.current } : null);
    },
    [current, finishCurrent, findFrom, items, order, shuffle]
  );

  const advance = useCallback(() => goTo(1), [goTo]);

  // Manifesto novo: recomeça do início.
  useEffect(() => {
    failedRef.current = new Set();
    const list = shuffle ? shuffled(items) : items;
    setOrder(list);
    const first = findFrom(list, 0, 1);
    playCounterRef.current += 1;
    setCurrent(first ? { ...first, cycle: playCounterRef.current } : null);
  }, [manifestVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sem nada para tocar agora (fora do horário): verifica de novo periodicamente.
  useEffect(() => {
    if (current) return undefined;
    const timer = setInterval(() => {
      const next = findFrom(order, 0, 1);
      if (next) {
        playCounterRef.current += 1;
        setCurrent({ ...next, cycle: playCounterRef.current });
      }
    }, IDLE_RECHECK_MS);
    return () => clearInterval(timer);
  }, [current, findFrom, order]);

  // Início de cada item: marca horário, avisa o status e faz o fade-in.
  useEffect(() => {
    startedAtRef.current = Date.now();
    if (!current) {
      onStatusChange({ currentItem: null, durationSeconds: null, positionSeconds: null, state: "idle" });
      return;
    }
    onStatusChange({ currentItem: toStatusItem(current.item), durationSeconds: current.item.durationSeconds, positionSeconds: 0, state: "playing" });
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [current?.cycle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Duração de cada item (vídeos avançam pelo próprio player; o timer é só segurança).
  useEffect(() => {
    if (!current) return undefined;
    const ms = current.item.type === "video" ? current.item.durationSeconds * 1000 + VIDEO_SAFETY_EXTRA_MS : current.item.durationSeconds * 1000;
    const timer = setTimeout(advance, Math.max(2000, ms));
    return () => clearTimeout(timer);
  }, [current?.cycle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progresso para a prévia ao vivo do painel.
  useEffect(() => {
    if (!current || current.item.type === "video") return undefined;
    const timer = setInterval(() => {
      onStatusChange({
        currentItem: toStatusItem(current.item),
        durationSeconds: current.item.durationSeconds,
        positionSeconds: Math.min(current.item.durationSeconds, (Date.now() - startedAtRef.current) / 1000),
        state: "playing"
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [current?.cycle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Controle remoto virtual.
  useEffect(() => {
    if (!remoteKeyCommand || handledRemoteRef.current === remoteKeyCommand.id) return;
    handledRemoteRef.current = remoteKeyCommand.id;
    if (["left", "up", "back"].includes(remoteKeyCommand.key)) goTo(-1);
    else goTo(1);
  }, [goTo, remoteKeyCommand]);

  const handleError = useCallback(
    (item: TvItem, message: string) => {
      failedRef.current.add(item.key);
      if (item.localUri) void deleteCachedFile(item.localUri);
      onError(item, message);
      advance();
    },
    [advance, onError]
  );

  // Dados dos widgets (cotação, clima, notícias) chegam atualizados sem reiniciar a lista.
  const latestByKey = useMemo(() => new Map(items.map((entry) => [entry.key, entry])), [items]);
  const legacyItem = useMemo(() => (current ? toLegacyItem(current.item) : null), [current]);

  if (!current || !legacyItem) {
    return <View style={styles.fill}>{idle}</View>;
  }

  const item = latestByKey.get(current.item.key) ?? current.item;
  const portrait = orientation === "portrait";
  let content: React.ReactNode;

  switch (item.type) {
    case "video":
      content = (
        <VideoPlayer
          item={legacyItem}
          key={current.cycle}
          muted={muted}
          onAdvanceCue={advance}
          onError={() => handleError(item, "Erro ao reproduzir o vídeo")}
          onProgress={(positionSeconds) =>
            onStatusChange({ currentItem: toStatusItem(item), durationSeconds: item.durationSeconds, positionSeconds, state: "playing" })
          }
          screenOrientation={orientation}
        />
      );
      break;
    case "image":
      content = <ImageDisplay item={legacyItem} key={current.cycle} onError={() => handleError(item, "Erro ao exibir a imagem")} screenOrientation={orientation} />;
      break;
    case "youtube":
    case "url":
      content = <WebContent item={item} key={current.cycle} muted={muted} onError={() => handleError(item, "Falha ao carregar conteúdo da internet")} />;
      break;
    case "clock":
      content = <ClockWidget item={item} key={current.cycle} timezone={timezone} />;
      break;
    case "currency":
      content = <CurrencyWidget item={item} key={current.cycle} timezone={timezone} />;
      break;
    case "weather":
      content = <WeatherWidget item={item} key={current.cycle} />;
      break;
    case "rss":
      content = <RssWidget item={item} key={current.cycle} portrait={portrait} />;
      break;
    case "notice":
      content = <NoticeWidget item={item} key={current.cycle} />;
      break;
    case "instagram":
      content = <InstagramWidget item={item} key={current.cycle} portrait={portrait} />;
      break;
    case "quote":
      content = <QuoteWidget item={item} key={current.cycle} />;
      break;
    case "countdown":
      content = <CountdownWidget item={item} key={current.cycle} />;
      break;
    case "holidays":
      content = <HolidaysWidget item={item} key={current.cycle} />;
      break;
    case "birthdays":
      content = <BirthdaysWidget item={item} key={current.cycle} timezone={timezone} />;
      break;
    case "qrcode":
      content = <QrCodeWidget item={item} key={current.cycle} portrait={portrait} />;
      break;
    default:
      content = null;
  }

  return <Animated.View style={[styles.fill, { opacity }]}>{content}</Animated.View>;
}

function shuffled<T>(list: T[]) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T];
  }
  return copy;
}

function toStatusItem(item: TvItem) {
  return { id: item.key, mediaId: item.mediaId };
}

/** Adapta o item do manifesto para os componentes de imagem/vídeo existentes. */
function toLegacyItem(item: TvItem): TvPlaylistItem {
  return {
    id: item.key,
    mediaId: item.mediaId,
    order: 0,
    displayDurationSeconds: item.durationSeconds,
    media: {
      id: item.mediaId,
      title: item.title,
      type: item.type,
      fileUrl: item.fileUrl ?? "",
      mimeType: item.mimeType ?? "",
      sizeBytes: 0,
      durationSeconds: item.durationSeconds,
      status: "ready",
      orientation: "auto",
      rotationDegrees: item.rotationDegrees,
      processingError: null,
      readyAt: null,
      localUri: item.localUri
    }
  };
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: "#000000",
    flex: 1
  }
});
