import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { isPublicHttpUrl, parseRss } from "@/server/services/externalData";
import { toLegacyPlaylist } from "@/server/services/manifestService";
import { getMediaDurationSeconds, publicMediaConfig } from "@/server/utils/serializers";
import type { DeviceManifest } from "@dialindooh/shared";

describe("parseRss", () => {
  it("lê itens RSS 2.0 com CDATA e imagem", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Notícia <b>um</b>]]></title>
      <description><![CDATA[<img src="https://img.example.com/a.jpg"/> Texto &amp; mais]]></description>
      <pubDate>Mon, 23 Mar 2026 10:00:00 GMT</pubDate></item><item><title>Dois</title></item></channel></rss>`;
    const items = parseRss(xml);
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe("Notícia um");
    expect(items[0]?.imageUrl).toBe("https://img.example.com/a.jpg");
    expect(items[0]?.description).toBe("Texto & mais");
    expect(items[0]?.publishedAt).toBe("2026-03-23T10:00:00.000Z");
  });

  it("lê feeds Atom", () => {
    const items = parseRss(`<feed><entry><title>Atom</title><summary>Resumo</summary></entry></feed>`);
    expect(items[0]?.title).toBe("Atom");
  });
});

describe("isPublicHttpUrl", () => {
  it("bloqueia endereços internos", () => {
    expect(isPublicHttpUrl("http://localhost/x")).toBe(false);
    expect(isPublicHttpUrl("http://127.0.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://169.254.169.254/latest")).toBe(false);
    expect(isPublicHttpUrl("http://10.0.0.5/")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.1/")).toBe(false);
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isPublicHttpUrl("https://g1.globo.com/rss")).toBe(true);
  });
});

describe("serializers", () => {
  it("remove o token do Instagram", () => {
    const config = publicMediaConfig({ type: "instagram", config: { accessToken: "segredo", postsCount: 1 } });
    expect(config).not.toHaveProperty("accessToken");
    expect(config).toMatchObject({ connected: true, postsCount: 1 });
  });

  it("duração padrão por tipo", () => {
    expect(getMediaDurationSeconds({ type: "image", durationSeconds: null })).toBe(10);
    expect(getMediaDurationSeconds({ type: "video", durationSeconds: null })).toBe(30);
    expect(getMediaDurationSeconds({ type: "clock", durationSeconds: null })).toBe(15);
    expect(getMediaDurationSeconds({ type: "video", durationSeconds: 42 }, 5)).toBe(5);
  });
});

describe("toLegacyPlaylist", () => {
  const base = { schedule: { startsAt: null, endsAt: null, timeFrom: null, timeTo: null, weekdays: [] }, recordStats: true, config: null, data: null, rotationDegrees: 0 as const, playlistId: null };
  const manifest: DeviceManifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    screen: { id: "s1", name: "Tela", orientation: "landscape", soundEnabled: false, timezone: "America/Sao_Paulo", refreshMinutes: 5, footerEnabled: false, shuffle: false },
    branding: { logoUrl: null, splashUrl: null },
    footer: null,
    items: [
      { ...base, key: "a", mediaId: "m1", type: "image", title: "Img", durationSeconds: 12, fileUrl: "https://cdn/x.jpg", mimeType: "image/jpeg" },
      { ...base, key: "b", mediaId: "m2", type: "clock", title: "Relógio", durationSeconds: 15, fileUrl: null, mimeType: null },
      { ...base, key: "c", mediaId: "m3", type: "video", title: "Vid", durationSeconds: 20, fileUrl: "https://cdn/v.mp4", mimeType: "video/mp4" }
    ]
  };

  it("mantém só imagens e vídeos para APKs antigos", () => {
    const legacy = toLegacyPlaylist(manifest);
    expect(legacy.playlist?.items.map((item) => item.mediaId)).toEqual(["m1", "m3"]);
    expect(legacy.playlist?.items[0]?.displayDurationSeconds).toBe(12);
    expect(legacy.playlist?.items[1]?.media.durationSeconds).toBe(20);
  });
});
