import { XMLParser } from "fast-xml-parser";
import type { CurrencyQuote, InstagramPost, RssItem, WeatherData } from "@dialindooh/shared";
import { prisma } from "@/server/db";

/**
 * Dados externos usados pelos widgets. Tudo é buscado no servidor e guardado em cache
 * (tabela ExternalCache), nunca pela TV. Se a fonte falhar, devolve o último valor salvo.
 */

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = "DialIndoohSignage/2.0 (+https://dial-indooh.vercel.app)";

async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T | null> {
  const existing = await prisma.externalCache.findUnique({ where: { key } }).catch(() => null);

  if (existing && Date.now() - existing.fetchedAt.getTime() < ttlSeconds * 1000) {
    return existing.data as T;
  }

  try {
    const data = await loader();
    await prisma.externalCache.upsert({
      where: { key },
      create: { key, data: data as never, fetchedAt: new Date() },
      update: { data: data as never, fetchedAt: new Date(), error: null }
    });
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[externalData] ${key}: ${message}`);
    await prisma.externalCache
      .update({ where: { key }, data: { error: message.slice(0, 500) } })
      .catch(() => undefined);
    return existing ? (existing.data as T) : null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} em ${new URL(url).hostname}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------- Cotações ---------- */

const CURRENCY_NAMES: Record<string, string> = {
  USD: "Dólar",
  EUR: "Euro",
  GBP: "Libra",
  ARS: "Peso argentino",
  BTC: "Bitcoin"
};

export async function getCurrencyQuotes(codes: string[]): Promise<CurrencyQuote[]> {
  const unique = [...new Set(codes.map((code) => code.toUpperCase()))].filter((code) => CURRENCY_NAMES[code]);

  if (unique.length === 0) {
    return [];
  }

  const all = await cached<Record<string, CurrencyQuote>>("currency:all", 30 * 60, loadAllQuotes);

  return unique.map((code) => all?.[code]).filter((quote): quote is CurrencyQuote => Boolean(quote));
}

/** Busca cotações com fontes reservas: AwesomeAPI → Frankfurter (BCE) + CoinGecko. */
export async function loadAllQuotes() {
  const result: Record<string, CurrencyQuote> = {};

  try {
    const pairs = Object.keys(CURRENCY_NAMES).map((code) => `${code}-BRL`).join(",");
    const response = await fetchWithTimeout(`https://economia.awesomeapi.com.br/json/last/${pairs}`);
    const json = (await response.json()) as Record<string, { code: string; bid: string; pctChange: string }>;

    for (const value of Object.values(json)) {
      if (value?.code && Number(value.bid) > 0) {
        result[value.code] = { code: value.code, name: CURRENCY_NAMES[value.code] ?? value.code, bid: Number(value.bid), pctChange: Number(value.pctChange) || 0 };
      }
    }
  } catch (error) {
    console.warn("[externalData] AwesomeAPI indisponível, usando fontes reservas:", error instanceof Error ? error.message : error);
  }

  if (!result.USD || !result.EUR || !result.GBP) {
    try {
      const response = await fetchWithTimeout("https://api.frankfurter.dev/v1/latest?base=BRL&symbols=USD,EUR,GBP");
      const json = (await response.json()) as { rates?: Record<string, number> };
      for (const [code, rate] of Object.entries(json.rates ?? {})) {
        if (!result[code] && rate > 0) {
          result[code] = { code, name: CURRENCY_NAMES[code] ?? code, bid: Number((1 / rate).toFixed(4)), pctChange: 0 };
        }
      }
    } catch (error) {
      console.warn("[externalData] Frankfurter indisponível:", error instanceof Error ? error.message : error);
    }
  }

  if (!result.BTC) {
    try {
      const response = await fetchWithTimeout("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true");
      const json = (await response.json()) as { bitcoin?: { brl?: number; brl_24h_change?: number } };
      if (json.bitcoin?.brl) {
        result.BTC = { code: "BTC", name: CURRENCY_NAMES.BTC ?? "Bitcoin", bid: json.bitcoin.brl, pctChange: json.bitcoin.brl_24h_change ?? 0 };
      }
    } catch {
      // Bitcoin é opcional.
    }
  }

  if (Object.keys(result).length === 0) {
    throw new Error("Nenhuma fonte de cotação respondeu.");
  }

  return result;
}

/* ---------- Clima (Open-Meteo, sem chave) ---------- */

const WEATHER_CODES: Array<[number[], string, string]> = [
  [[0], "Céu limpo", "sun"],
  [[1, 2], "Parcialmente nublado", "cloud-sun"],
  [[3], "Nublado", "cloud"],
  [[45, 48], "Neblina", "fog"],
  [[51, 53, 55, 56, 57], "Garoa", "drizzle"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Chuva", "rain"],
  [[71, 73, 75, 77, 85, 86], "Neve", "snow"],
  [[95, 96, 99], "Tempestade", "storm"]
];

function describeWeather(code: number) {
  const match = WEATHER_CODES.find(([codes]) => codes.includes(code));
  return { description: match?.[1] ?? "Tempo estável", icon: match?.[2] ?? "cloud-sun" };
}

async function geocodeCity(city: string, state?: string | null) {
  const key = `geo:${normalize(city)}:${normalize(state ?? "")}`;

  return cached<{ latitude: number; longitude: number; name: string } | null>(key, 60 * 60 * 24 * 30, async () => {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=pt&countryCode=BR`;
    const response = await fetchWithTimeout(url);
    const json = (await response.json()) as {
      results?: Array<{ latitude: number; longitude: number; name: string; admin1?: string; admin1_code?: string }>;
    };
    const results = json.results ?? [];
    const stateName = state ? BR_STATES[state.toUpperCase()] : null;
    const best =
      results.find((result) => stateName && normalize(result.admin1 ?? "") === normalize(stateName)) ?? results[0];

    if (!best) {
      throw new Error(`Cidade não encontrada: ${city}`);
    }

    return { latitude: best.latitude, longitude: best.longitude, name: best.name };
  });
}

/** Localização aproximada pelo IP público da internet do local (usada quando o terminal não tem cidade). */
async function geolocateIp(ip: string) {
  if (!ip || !isPublicIp(ip)) {
    return null;
  }

  return cached<{ latitude: number; longitude: number; name: string } | null>(`geoip:${ip}`, 60 * 60 * 24 * 30, async () => {
    const response = await fetchWithTimeout(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,latitude,longitude`);
    const json = (await response.json()) as { success?: boolean; city?: string; latitude?: number; longitude?: number };
    if (!json.success || json.latitude == null || json.longitude == null) {
      throw new Error(`IP sem localização: ${ip}`);
    }
    return { latitude: json.latitude, longitude: json.longitude, name: json.city ?? "Sua cidade" };
  });
}

function isPublicIp(ip: string) {
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) && isPublicHttpUrl(`http://${ip}/`);
}

export async function getWeather(city: string | null | undefined, state?: string | null, fallbackIp?: string | null): Promise<WeatherData | null> {
  const location = city ? await geocodeCity(city, state) : fallbackIp ? await geolocateIp(fallbackIp) : null;

  if (!location) {
    return null;
  }

  const key = `weather:${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}`;

  return cached<WeatherData>(key, 30 * 60, async () => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}` +
      "&current=temperature_2m,apparent_temperature,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min" +
      "&timezone=America%2FSao_Paulo&forecast_days=4";
    const response = await fetchWithTimeout(url);
    const json = (await response.json()) as {
      current: { temperature_2m: number; apparent_temperature: number; weather_code: number };
      daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
    };
    const current = describeWeather(json.current.weather_code);

    return {
      city: location.name,
      temperature: Math.round(json.current.temperature_2m),
      apparentTemperature: Math.round(json.current.apparent_temperature),
      description: current.description,
      icon: current.icon,
      max: Math.round(json.daily.temperature_2m_max[0] ?? json.current.temperature_2m),
      min: Math.round(json.daily.temperature_2m_min[0] ?? json.current.temperature_2m),
      forecast: json.daily.time.slice(1, 4).map((date, index) => {
        const info = describeWeather(json.daily.weather_code[index + 1] ?? 0);
        return {
          date,
          max: Math.round(json.daily.temperature_2m_max[index + 1] ?? 0),
          min: Math.round(json.daily.temperature_2m_min[index + 1] ?? 0),
          icon: info.icon,
          description: info.description
        };
      })
    };
  });
}

/* ---------- RSS ---------- */

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "__cdata" });

export async function getRssItems(url: string, maxItems = 5): Promise<RssItem[]> {
  if (!isPublicHttpUrl(url)) {
    return [];
  }

  const items = await cached<RssItem[]>(`rss:${url}`, 20 * 60, async () => {
    const response = await fetchWithTimeout(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml" } });
    const text = await response.text();

    if (text.length > 3_000_000) {
      throw new Error("Feed RSS grande demais.");
    }

    return parseRss(text);
  });

  return (items ?? []).slice(0, maxItems);
}

export function parseRss(xml: string): RssItem[] {
  const doc = xmlParser.parse(xml) as Record<string, any>;
  const channelItems = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.["rdf:RDF"]?.item ?? [];
  const list = Array.isArray(channelItems) ? channelItems : [channelItems];

  return list
    .map((item: Record<string, any>) => {
      const rawDescription = textOf(item.description ?? item.summary ?? item.content ?? item["content:encoded"]);
      const title = cleanText(textOf(item.title));

      return {
        title,
        description: cleanText(rawDescription).slice(0, 280) || null,
        imageUrl: findImage(item, rawDescription),
        publishedAt: toIso(textOf(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]))
      };
    })
    .filter((item) => item.title)
    .slice(0, 20);
}

function textOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("__cdata" in record) return textOf(record.__cdata);
    if ("#text" in record) return textOf(record["#text"]);
  }
  return "";
}

function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function findImage(item: Record<string, any>, description: string) {
  const candidates = [
    item["media:content"]?.["@_url"],
    Array.isArray(item["media:content"]) ? item["media:content"][0]?.["@_url"] : null,
    item["media:thumbnail"]?.["@_url"],
    item.enclosure?.["@_type"]?.startsWith?.("image") ? item.enclosure?.["@_url"] : null,
    /<img[^>]+src=["']([^"']+)["']/i.exec(description)?.[1]
  ];
  const found = candidates.find((value) => typeof value === "string" && /^https:\/\//i.test(value));
  return found ?? null;
}

function toIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/* ---------- Feriados nacionais (BrasilAPI) ---------- */

export async function getUpcomingHolidays(today: string, count: number) {
  const year = Number(today.slice(0, 4));
  const lists = await Promise.all(
    [year, year + 1].map((value) =>
      cached<Array<{ date: string; name: string }>>(`holidays:${value}`, 7 * 24 * 60 * 60, async () => {
        const response = await fetchWithTimeout(`https://brasilapi.com.br/api/feriados/v1/${value}`);
        return (await response.json()) as Array<{ date: string; name: string }>;
      })
    )
  );
  const weekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const todayTime = new Date(`${today}T12:00:00Z`).getTime();

  return lists
    .flatMap((list) => list ?? [])
    .filter((holiday) => Boolean(holiday?.date))
    .filter((holiday) => holiday.date >= today)
    .sort((left, right) => left.date.localeCompare(right.date))
    .filter((holiday, index, all) => all.findIndex((item) => item.date === holiday.date) === index)
    .slice(0, count)
    .map((holiday) => {
      const time = new Date(`${holiday.date}T12:00:00Z`).getTime();
      return {
        date: holiday.date,
        name: holiday.name,
        weekday: weekdays[new Date(time).getUTCDay()] ?? "",
        daysUntil: Math.round((time - todayTime) / 86_400_000)
      };
    });
}

/* ---------- Instagram (API oficial com login do Instagram) ---------- */

export async function getInstagramPosts(mediaId: string, accessToken: string, count: number): Promise<InstagramPost[]> {
  // Atualiza 3x ao dia (~8h).
  const posts = await cached<InstagramPost[]>(`instagram:${mediaId}`, 8 * 60 * 60, async () => {
    const url =
      "https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count" +
      `&limit=12&access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetchWithTimeout(url);
    const json = (await response.json()) as {
      data?: Array<{ id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; timestamp?: string; like_count?: number }>;
    };

    return (json.data ?? [])
      .map((post) => ({
        id: post.id,
        imageUrl: post.media_type === "VIDEO" ? post.thumbnail_url ?? "" : post.media_url ?? "",
        caption: post.caption?.slice(0, 300) ?? null,
        timestamp: post.timestamp ?? null,
        likeCount: post.like_count ?? null
      }))
      .filter((post) => post.imageUrl);
  });

  return (posts ?? []).slice(0, count);
}

export async function getInstagramProfile(accessToken: string) {
  const response = await fetchWithTimeout(
    `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
  );
  return (await response.json()) as { id: string; username: string };
}

/** Renova o token de longa duração (válido por 60 dias). */
export async function refreshInstagramToken(accessToken: string) {
  const response = await fetchWithTimeout(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`
  );
  return (await response.json()) as { access_token: string; expires_in: number };
}

/* ---------- utilitários ---------- */

/** Bloqueia endereços internos (localhost, IPs privados) em URLs informadas pelo usuário. */
export function isPublicHttpUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false;
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return false;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number) as [number, number];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) {
      return false;
    }
  }

  if (host.includes(":")) {
    return false;
  }

  return true;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export const BR_STATES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins"
};
