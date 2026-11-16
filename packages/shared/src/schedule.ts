import type { ScheduleDto } from "./index";

export interface ZonedNow {
  /** Data local no formato YYYY-MM-DD. */
  date: string;
  /** Minutos desde meia-noite no horário local. */
  minutes: number;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Hora atual no fuso informado. Se o fuso não for suportado, usa o relógio do aparelho. */
export function getZonedNow(timezone: string | null | undefined, now: Date = new Date()): ZonedNow {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        weekday: "short"
      }).formatToParts(now);
      const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
      const hour = Number(get("hour")) % 24;
      const weekday = WEEKDAY_INDEX[get("weekday")];

      if (weekday !== undefined && !Number.isNaN(hour)) {
        return {
          date: `${get("year")}-${get("month")}-${get("day")}`,
          minutes: hour * 60 + Number(get("minute")),
          weekday
        };
      }
    } catch {
      // Fuso não suportado pelo motor JS: cai para o relógio local.
    }
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    minutes: now.getHours() * 60 + now.getMinutes(),
    weekday: now.getDay()
  };
}

export function parseTimeOfDay(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Indica se um item agendado deve tocar agora.
 * - startsAt/endsAt comparados pela data local (dia inteiro inclusivo);
 * - faixa de horário pode atravessar a meia-noite (ex.: 22:00–02:00);
 * - weekdays vazio = todos os dias.
 */
export function isScheduleActive(schedule: Partial<ScheduleDto> | null | undefined, now: ZonedNow): boolean {
  if (!schedule) {
    return true;
  }

  if (schedule.startsAt && now.date < schedule.startsAt.slice(0, 10)) {
    return false;
  }

  if (schedule.endsAt && now.date > schedule.endsAt.slice(0, 10)) {
    return false;
  }

  if (schedule.weekdays && schedule.weekdays.length > 0 && !schedule.weekdays.includes(now.weekday)) {
    return false;
  }

  const from = parseTimeOfDay(schedule.timeFrom);
  const to = parseTimeOfDay(schedule.timeTo);

  if (from === null && to === null) {
    return true;
  }

  const start = from ?? 0;
  const end = to ?? 24 * 60;

  if (start <= end) {
    return now.minutes >= start && now.minutes < end;
  }

  return now.minutes >= start || now.minutes < end;
}

/** Combina duas agendas (ex.: grupo + mídia): o item só toca quando as duas permitem. */
export function isEveryScheduleActive(schedules: Array<Partial<ScheduleDto> | null | undefined>, now: ZonedNow) {
  return schedules.every((schedule) => isScheduleActive(schedule, now));
}

export function extractYoutubeId(value: string) {
  const trimmed = value.trim();

  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\.|^m\./, "");

    if (host === "youtu.be") {
      return url.pathname.slice(1, 12) || null;
    }

    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const fromQuery = url.searchParams.get("v");

      if (fromQuery) {
        return fromQuery.slice(0, 11);
      }

      const match = /\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(url.pathname);
      return match?.[1] ?? null;
    }
  } catch {
    return null;
  }

  return null;
}
