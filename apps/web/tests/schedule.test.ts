import { describe, expect, it } from "vitest";
import { extractYoutubeId, getZonedNow, isScheduleActive, parseTimeOfDay } from "@dialindooh/shared";

const monday10h = { date: "2026-03-23", minutes: 10 * 60, weekday: 1 };

describe("isScheduleActive", () => {
  it("sem agenda sempre toca", () => {
    expect(isScheduleActive(null, monday10h)).toBe(true);
    expect(isScheduleActive({ startsAt: null, endsAt: null, timeFrom: null, timeTo: null, weekdays: [] }, monday10h)).toBe(true);
  });

  it("respeita período de datas (inclusivo)", () => {
    expect(isScheduleActive({ startsAt: "2026-03-23T12:00:00.000Z", endsAt: null }, monday10h)).toBe(true);
    expect(isScheduleActive({ startsAt: "2026-03-24T12:00:00.000Z" }, monday10h)).toBe(false);
    expect(isScheduleActive({ endsAt: "2026-03-22T12:00:00.000Z" }, monday10h)).toBe(false);
  });

  it("respeita faixa de horário", () => {
    expect(isScheduleActive({ timeFrom: "08:00", timeTo: "17:00" }, monday10h)).toBe(true);
    expect(isScheduleActive({ timeFrom: "11:00", timeTo: "17:00" }, monday10h)).toBe(false);
    expect(isScheduleActive({ timeFrom: "08:00", timeTo: "10:00" }, monday10h)).toBe(false);
  });

  it("faixa que atravessa a meia-noite", () => {
    expect(isScheduleActive({ timeFrom: "22:00", timeTo: "02:00" }, { ...monday10h, minutes: 23 * 60 })).toBe(true);
    expect(isScheduleActive({ timeFrom: "22:00", timeTo: "02:00" }, { ...monday10h, minutes: 60 })).toBe(true);
    expect(isScheduleActive({ timeFrom: "22:00", timeTo: "02:00" }, monday10h)).toBe(false);
  });

  it("respeita dias da semana", () => {
    expect(isScheduleActive({ weekdays: [1, 2, 3] }, monday10h)).toBe(true);
    expect(isScheduleActive({ weekdays: [0, 6] }, monday10h)).toBe(false);
  });
});

describe("getZonedNow", () => {
  it("converte para o fuso informado", () => {
    const now = getZonedNow("America/Sao_Paulo", new Date("2026-03-23T13:30:00.000Z"));
    expect(now).toEqual({ date: "2026-03-23", minutes: 10 * 60 + 30, weekday: 1 });
  });

  it("cai para o relógio local com fuso inválido", () => {
    const result = getZonedNow("Fuso/Inexistente", new Date());
    expect(result.minutes).toBeGreaterThanOrEqual(0);
  });
});

describe("helpers", () => {
  it("parseTimeOfDay", () => {
    expect(parseTimeOfDay("07:05")).toBe(425);
    expect(parseTimeOfDay("24:00")).toBeNull();
    expect(parseTimeOfDay("abc")).toBeNull();
  });

  it("extractYoutubeId", () => {
    expect(extractYoutubeId("https://www.youtube.com/watch?v=qxzQR5uwWsk")).toBe("qxzQR5uwWsk");
    expect(extractYoutubeId("https://youtu.be/qxzQR5uwWsk?t=3")).toBe("qxzQR5uwWsk");
    expect(extractYoutubeId("https://www.youtube.com/shorts/qxzQR5uwWsk")).toBe("qxzQR5uwWsk");
    expect(extractYoutubeId("https://example.com/watch?v=qxzQR5uwWsk")).toBeNull();
  });
});
