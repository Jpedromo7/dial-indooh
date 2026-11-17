"use client";

import { useEffect, useRef, useState } from "react";
import type { CurrencyQuote, MediaDto, RssItem, WeatherData } from "@dialindooh/shared";
import { useQrImage } from "@/components/widgets/extra-editors";
import {
  BirthdaysPreview,
  ClockPreview,
  CountdownPreview,
  CurrencyPreview,
  HolidaysPreview,
  NoticePreview,
  QrPreview,
  QuotePreview,
  RssPreview,
  WeatherPreview
} from "@/components/widgets/widget-preview";
import { apiClient } from "@/lib/api-client";

const BASE_WIDTH = 720;

/** Renderiza a prévia em tamanho de "TV" e reduz para caber no cartão. */
function Scaled({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / BASE_WIDTH);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-black" ref={ref}>
      <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})`, width: BASE_WIDTH }}>
        {children}
      </div>
    </div>
  );
}

interface PreviewData {
  quotes?: CurrencyQuote[];
  weather?: WeatherData | null;
  rss?: RssItem[];
  quote?: { text: string };
  holidays?: Array<{ date: string; name: string; weekday: string; daysUntil: number }>;
}

/** Miniatura fiel de um conteúdo dinâmico (com dados reais quando houver). */
export function DynamicMediaPreview({ media }: { media: MediaDto }) {
  const config = (media.config ?? {}) as Record<string, unknown>;
  const [data, setData] = useState<PreviewData>({});
  const qrImage = useQrImage(media.type === "qrcode" ? config : {});

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (media.type === "currency") return apiClient.previewWidget({ type: "currency", currencies: (config.currencies as string[]) ?? ["USD"] });
      if (media.type === "weather")
        return apiClient.previewWidget({ type: "weather", city: (config.city as string) || "São Paulo", state: (config.state as string) || (config.city ? null : "SP") });
      if (media.type === "rss" && config.url) return apiClient.previewWidget({ type: "rss", url: config.url as string, maxItems: 1 });
      if (media.type === "quote") return apiClient.previewWidget({ type: "quote", theme: config.theme as string, phrases: (config.phrases as string[]) ?? [] });
      if (media.type === "holidays") return apiClient.previewWidget({ type: "holidays", count: Number(config.count) || 4 });
      return {};
    };
    load()
      .then((result) => active && setData(result ?? {}))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [media.id]); // eslint-disable-line react-hooks/exhaustive-deps

  let content: React.ReactNode = null;
  switch (media.type) {
    case "clock":
      content = <ClockPreview config={config as never} />;
      break;
    case "currency":
      content = <CurrencyPreview config={config as never} quotes={data.quotes ?? []} />;
      break;
    case "weather":
      content = <WeatherPreview config={config as never} weather={data.weather ?? null} />;
      break;
    case "rss":
      content = <RssPreview config={config as never} items={data.rss ?? []} />;
      break;
    case "notice":
      content = <NoticePreview config={config as never} />;
      break;
    case "quote":
      content = <QuotePreview config={config as never} text={data.quote?.text ?? "…"} />;
      break;
    case "countdown":
      content = <CountdownPreview config={config as never} />;
      break;
    case "holidays":
      content = <HolidaysPreview config={config as never} holidays={data.holidays ?? []} />;
      break;
    case "birthdays":
      content = <BirthdaysPreview config={config as never} />;
      break;
    case "qrcode":
      content = <QrPreview config={config as never} qrImage={qrImage} />;
      break;
    default:
      content = <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">{media.title}</div>;
  }

  return <Scaled>{content}</Scaled>;
}
