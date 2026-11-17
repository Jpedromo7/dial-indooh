import { z } from "zod";
import { requireUser } from "@/server/auth";
import { apiRoute, readJson } from "@/server/http";
import { getZonedNow } from "@dialindooh/shared";
import { CURIOSITIES, HEALTH_TIPS, MOTIVATIONAL, pickDaily } from "@/server/content/phrases";
import { getCurrencyQuotes, getRssItems, getUpcomingHolidays, getWeather } from "@/server/services/externalData";

export const runtime = "nodejs";

const previewSchema = z.object({
  type: z.enum(["currency", "weather", "rss", "quote", "holidays"]),
  theme: z.enum(["motivacional", "curiosidades", "saude", "personalizado"]).optional(),
  phrases: z.array(z.string().max(280)).max(100).optional(),
  count: z.number().int().min(1).max(6).optional(),
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
  if (body.type === "quote") {
    const today = getZonedNow("America/Sao_Paulo").date;
    const list =
      body.theme === "personalizado" && body.phrases?.length
        ? body.phrases
        : body.theme === "curiosidades"
          ? CURIOSITIES
          : body.theme === "saude"
            ? HEALTH_TIPS
            : MOTIVATIONAL;
    return { quote: { text: pickDaily(list, today) } };
  }
  if (body.type === "holidays") return { holidays: await getUpcomingHolidays(getZonedNow("America/Sao_Paulo").date, body.count ?? 4) };
  if (body.type === "weather") return { weather: await getWeather(body.city ?? "São Paulo", body.state ?? "SP") };
  return { rss: body.url ? await getRssItems(body.url, body.maxItems ?? 5) : [] };
});
