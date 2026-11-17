import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { loadAllQuotes } from "@/server/services/externalData";

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("cotações com fontes reservas", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("usa Frankfurter e CoinGecko quando a AwesomeAPI falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("awesomeapi")) return respond({ message: "blocked" }, 403);
        if (url.includes("frankfurter")) return respond({ rates: { USD: 0.17528, EUR: 0.15914, GBP: 0.1328 } });
        if (url.includes("coingecko")) return respond({ bitcoin: { brl: 373048, brl_24h_change: 1.39 } });
        return respond({}, 404);
      })
    );

    const quotes = await loadAllQuotes();
    expect(quotes.USD?.bid).toBeCloseTo(5.705, 2);
    expect(quotes.EUR?.bid).toBeCloseTo(6.284, 2);
    expect(quotes.BTC?.bid).toBe(373048);
  });

  it("falha só quando nenhuma fonte responde", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respond({}, 500)));
    await expect(loadAllQuotes()).rejects.toThrow("Nenhuma fonte");
  });
});
