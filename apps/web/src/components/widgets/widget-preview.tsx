"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";
import type {
  ClockConfig,
  CurrencyConfig,
  CurrencyQuote,
  FooterConfig,
  InstagramPost,
  NoticeConfig,
  RssConfig,
  RssItem,
  WeatherConfig,
  WeatherData
} from "@dialindooh/shared";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function WeatherIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon =
    { sun: Sun, "cloud-sun": CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning }[icon] ??
    CloudSun;
  return <Icon className={className} />;
}

function Frame({ background, color, children, portrait }: { background: string; color: string; children: React.ReactNode; portrait?: boolean }) {
  return (
    <div
      className={cn("relative mx-auto overflow-hidden rounded-lg shadow-xl", portrait ? "aspect-[9/16] w-56" : "aspect-video w-full")}
      style={{ background: `radial-gradient(circle at 20% 10%, rgba(255,255,255,0.18), transparent 45%), ${background}`, color }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-[5%] text-center">{children}</div>
    </div>
  );
}

export function ClockPreview({ config, portrait }: { config: ClockConfig; portrait?: boolean }) {
  const now = useNow();
  const date = `${WEEKDAYS[now.getDay()]}, ${now.toLocaleDateString("pt-BR")}`;
  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      <p className="font-medium opacity-90" style={{ fontSize: portrait ? 14 : 22 }}>
        {date}
      </p>
      <p className="font-bold tabular-nums leading-none" style={{ fontSize: portrait ? 44 : 96 }}>
        {now.toLocaleTimeString("pt-BR")}
      </p>
      {config.logoUrl ? <img alt="" className="mt-4 max-h-[22%] max-w-[40%] rounded bg-white/90 object-contain p-2" src={config.logoUrl} /> : null}
    </Frame>
  );
}

export function CurrencyPreview({ config, quotes, portrait }: { config: CurrencyConfig; quotes: CurrencyQuote[]; portrait?: boolean }) {
  const today = new Date().toLocaleDateString("pt-BR");
  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      <p className="mb-3 font-bold" style={{ fontSize: portrait ? 16 : 22 }}>
        Cotação em {today}
      </p>
      <div className={cn("grid w-full gap-2", portrait ? "grid-cols-1" : quotes.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {(quotes.length ? quotes : config.currencies.map((code) => ({ code, name: code, bid: 0, pctChange: 0 }))).map((quote) => (
          <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur" key={quote.code}>
            <p className="text-sm font-semibold opacity-90">
              {quote.name} ({quote.code})
            </p>
            <p className="font-bold tabular-nums" style={{ fontSize: portrait ? 24 : 34 }}>
              R$ {quote.bid ? quote.bid.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: quote.code === "BTC" ? 0 : 2 }) : "--"}
            </p>
            <p className={cn("text-xs font-semibold", quote.pctChange >= 0 ? "text-emerald-200" : "text-red-200")}>
              {quote.pctChange >= 0 ? "▲" : "▼"} {Math.abs(quote.pctChange).toFixed(2)}%
            </p>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function WeatherPreview({ config, weather, portrait }: { config: WeatherConfig; weather: WeatherData | null; portrait?: boolean }) {
  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      {weather ? (
        <>
          <p className="font-semibold" style={{ fontSize: portrait ? 18 : 24 }}>
            {weather.city}
          </p>
          <div className="flex items-center gap-4">
            <WeatherIcon className="h-16 w-16" icon={weather.icon} />
            <p className="font-bold" style={{ fontSize: portrait ? 48 : 72 }}>
              {weather.temperature}°
            </p>
          </div>
          <p className="opacity-90">{weather.description}</p>
          <p className="text-sm opacity-80">
            Máx {weather.max}° · Mín {weather.min}°
          </p>
          {weather.forecast?.length ? (
            <div className="mt-3 flex gap-3">
              {weather.forecast.map((day) => (
                <div className="rounded-lg bg-white/15 px-3 py-2 text-xs" key={day.date}>
                  <p>{WEEKDAYS[new Date(`${day.date}T12:00:00`).getDay()]?.slice(0, 3)}</p>
                  <WeatherIcon className="mx-auto my-1 h-5 w-5" icon={day.icon} />
                  <p>
                    {day.max}° / {day.min}°
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="opacity-80">Informe a cidade para ver a prévia.</p>
      )}
    </Frame>
  );
}

export function RssPreview({ config, items, portrait }: { config: RssConfig; items: RssItem[]; portrait?: boolean }) {
  const item = items[0];
  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      {item ? (
        <div className={cn("flex h-full w-full gap-4 text-left", portrait ? "flex-col" : "flex-row items-center")}>
          {item.imageUrl ? <img alt="" className={cn("rounded-lg object-cover", portrait ? "h-1/2 w-full" : "h-full w-1/2")} src={item.imageUrl} /> : null}
          <div className="flex flex-1 flex-col justify-center gap-2">
            <div className="flex items-center gap-2">
              {config.logoUrl ? <img alt="" className="h-6 object-contain" src={config.logoUrl} /> : null}
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{config.source || "Notícias"}</span>
            </div>
            <p className="font-bold leading-tight" style={{ fontSize: portrait ? 18 : 26 }}>
              {item.title}
            </p>
            {item.description ? <p className="line-clamp-3 text-sm opacity-85">{item.description}</p> : null}
          </div>
        </div>
      ) : (
        <p className="opacity-80">Informe um feed RSS válido para ver a prévia.</p>
      )}
    </Frame>
  );
}

export function NoticePreview({ config, portrait }: { config: NoticeConfig; portrait?: boolean }) {
  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      {config.imageUrl ? <img alt="" className="mb-4 max-h-[35%] max-w-[60%] object-contain" src={config.imageUrl} /> : null}
      <p className="font-extrabold leading-tight" style={{ fontSize: portrait ? 24 : 40 }}>
        {config.text || "Seu aviso aqui"}
      </p>
      {config.subtitle ? <p className="mt-3 opacity-90" style={{ fontSize: portrait ? 14 : 20 }}>{config.subtitle}</p> : null}
    </Frame>
  );
}

export function InstagramPreview({
  background,
  color,
  username,
  profileImageUrl,
  posts,
  count,
  portrait
}: {
  background: string;
  color: string;
  username: string | null;
  profileImageUrl: string | null;
  posts: InstagramPost[];
  count: number;
  portrait?: boolean;
}) {
  const shown = posts.slice(0, count);
  return (
    <Frame background={background} color={color} portrait={portrait}>
      <div className="mb-3 flex items-center gap-2">
        {profileImageUrl ? <img alt="" className="h-9 w-9 rounded-full object-cover" src={profileImageUrl} /> : <span className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-violet-600" />}
        <span className="font-semibold">@{username ?? "suaconta"}</span>
      </div>
      <div className={cn("grid w-full gap-2", count === 3 && !portrait ? "grid-cols-3" : "grid-cols-1")}>
        {(shown.length ? shown : Array.from({ length: count }, (_, index) => ({ id: String(index), imageUrl: "", caption: "Postagem" }))).map((post) => (
          <div className="overflow-hidden rounded-lg bg-white/10" key={post.id}>
            {post.imageUrl ? <img alt="" className="aspect-square w-full object-cover" src={post.imageUrl} /> : <div className="aspect-square w-full bg-white/10" />}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function FooterPreview({ config, weather }: { config: FooterConfig; weather?: WeatherData | null }) {
  const now = useNow();
  const duration = config.speed === "fast" ? 10 : config.speed === "slow" ? 30 : 18;

  return (
    <div className="overflow-hidden rounded-lg border bg-black">
      <div className="flex aspect-[16/7] items-center justify-center text-sm text-muted-foreground">Conteúdo do terminal</div>
      <div className="flex h-12 items-center gap-3 px-3" style={{ background: config.background, color: config.color }}>
        {config.logoUrl ? <img alt="" className="h-8 max-w-[6rem] object-contain" src={config.logoUrl} /> : null}
        {config.showPhrase ? (
          <div className="relative flex-1 overflow-hidden whitespace-nowrap">
            <span className="inline-block animate-[ticker_linear_infinite] font-medium" style={{ animationDuration: `${duration}s` }}>
              {config.phrase || "Sua frase aqui"}
            </span>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {config.showWeather && weather ? (
          <span className="flex items-center gap-1 text-sm font-semibold">
            {config.showIcons ? <WeatherIcon className="h-4 w-4" icon={weather.icon} /> : null}
            {weather.temperature}°
          </span>
        ) : null}
        {config.showDate ? <span className="text-sm">{now.toLocaleDateString("pt-BR")}</span> : null}
        {config.showTime ? <span className="text-sm font-bold tabular-nums">{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span> : null}
      </div>
    </div>
  );
}

/* ---------- Tipos adicionais ---------- */

export function QuotePreview({ config, text, portrait }: { config: { title?: string | null; background: string; color: string }; text: string; portrait?: boolean }) {
  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest opacity-80">{config.title || "Frase do dia"}</p>
      <p className="font-bold leading-snug" style={{ fontSize: portrait ? 18 : 30 }}>
        “{text}”
      </p>
    </Frame>
  );
}

function countdownParts(target: string, now: Date) {
  const diff = Math.max(0, new Date(target).getTime() - now.getTime());
  return {
    done: diff === 0,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000)
  };
}

export function CountdownPreview({
  config,
  portrait
}: {
  config: { title: string; target: string; finishedText?: string | null; background: string; color: string; imageUrl?: string | null };
  portrait?: boolean;
}) {
  const now = useNow();
  const parts = countdownParts(config.target, now);
  const boxes: Array<[number, string]> = [
    [parts.days, "dias"],
    [parts.hours, "horas"],
    [parts.minutes, "min"],
    [parts.seconds, "seg"]
  ];

  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      {config.imageUrl ? <img alt="" className="mb-3 max-h-[25%] object-contain" src={config.imageUrl} /> : null}
      <p className="mb-4 font-bold" style={{ fontSize: portrait ? 18 : 28 }}>
        {config.title || "Contagem regressiva"}
      </p>
      {parts.done ? (
        <p className="font-extrabold" style={{ fontSize: portrait ? 24 : 40 }}>
          {config.finishedText || "Chegou o grande dia!"}
        </p>
      ) : (
        <div className="flex gap-2">
          {boxes.map(([value, label]) => (
            <div className="min-w-[3.5rem] rounded-lg bg-white/15 px-2 py-2" key={label}>
              <p className="font-extrabold tabular-nums" style={{ fontSize: portrait ? 22 : 36 }}>
                {String(value).padStart(2, "0")}
              </p>
              <p className="text-xs uppercase opacity-80">{label}</p>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}

export function HolidaysPreview({
  config,
  holidays,
  portrait
}: {
  config: { title?: string | null; background: string; color: string };
  holidays: Array<{ date: string; name: string; weekday: string; daysUntil: number }>;
  portrait?: boolean;
}) {
  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      <p className="mb-3 font-bold" style={{ fontSize: portrait ? 18 : 26 }}>
        {config.title || "Próximos feriados"}
      </p>
      <div className="grid w-full gap-2">
        {holidays.map((holiday) => (
          <div className="flex items-center justify-between rounded-lg bg-white/15 px-3 py-2 text-left" key={holiday.date}>
            <div>
              <p className="font-semibold">{holiday.name}</p>
              <p className="text-xs opacity-80">
                {holiday.date.slice(8, 10)}/{holiday.date.slice(5, 7)} · {holiday.weekday}
              </p>
            </div>
            <p className="text-sm font-bold">{holiday.daysUntil === 0 ? "Hoje" : `em ${holiday.daysUntil} dias`}</p>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function BirthdaysPreview({
  config,
  portrait
}: {
  config: { title?: string | null; background: string; color: string; people: Array<{ name: string; day: number; month: number; role?: string | null }> };
  portrait?: boolean;
}) {
  const month = new Date().getMonth() + 1;
  const people = config.people.filter((person) => person.month === month).sort((left, right) => left.day - right.day);
  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long" });

  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      <p className="text-4xl">🎉</p>
      <p className="mb-3 font-bold capitalize" style={{ fontSize: portrait ? 18 : 26 }}>
        {config.title || `Aniversariantes de ${monthName}`}
      </p>
      {people.length === 0 ? <p className="opacity-80">Nenhum aniversariante neste mês (não aparece na TV).</p> : null}
      <div className="grid w-full grid-cols-2 gap-2">
        {people.slice(0, 12).map((person) => (
          <div className="rounded-lg bg-white/15 px-3 py-1.5 text-left" key={`${person.name}-${person.day}`}>
            <p className="truncate font-semibold">{person.name}</p>
            <p className="text-xs opacity-80">
              Dia {person.day}
              {person.role ? ` · ${person.role}` : ""}
            </p>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function QrPreview({
  config,
  qrImage,
  portrait
}: {
  config: { title: string; subtitle?: string | null; background: string; color: string };
  qrImage: string | null;
  portrait?: boolean;
}) {
  return (
    <Frame background={config.background} color={config.color} portrait={portrait}>
      <div className={cn("flex items-center gap-6", portrait ? "flex-col" : "flex-row")}>
        <div className="rounded-xl bg-white p-2">
          {qrImage ? <img alt="QR Code" className="h-32 w-32" src={qrImage} /> : <div className="h-32 w-32 bg-slate-200" />}
        </div>
        <div className={portrait ? "text-center" : "text-left"}>
          <p className="font-extrabold" style={{ fontSize: portrait ? 20 : 30 }}>
            {config.title || "Aponte a câmera"}
          </p>
          {config.subtitle ? <p className="mt-2 opacity-90">{config.subtitle}</p> : null}
        </div>
      </div>
    </Frame>
  );
}
