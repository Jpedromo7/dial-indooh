import { z } from "zod";
import { requireUser } from "@/server/auth";
import { apiRoute, readJson } from "@/server/http";
import { getCurrencyQuotes, getRssItems, getWeather } from "@/server/services/externalData";

export const runtime = "nodejs";

const previewSchema = z.object({
  type: z.enum(["currency", "weather", "rss"]),
  currencies: z.array(z.string().max(5)).max(5).optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(2).nullable().optional(),
  url: z.string().url().optional(),
  maxItems: z.number().int().min(1).max(10).optional()
});

/** Dados reais para a prévia ao vivo dos widgets no painel. */
export const POST = apiRoute(async (request) => {
  await requireUser(request);
  const body = await readJson(request, previewSchema);

  if (body.type === "currency") return { quotes: await getCurrencyQuotes(body.currencies ?? ["USD"]) };
  if (body.type === "weather") return { weather: await getWeather(body.city ?? "São Paulo", body.state ?? "SP") };
  return { rss: body.url ? await getRssItems(body.url, body.maxItems ?? 5) : [] };
});
