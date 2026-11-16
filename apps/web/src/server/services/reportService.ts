import { Prisma } from "@prisma/client";
import type { DashboardDto, NotificationDto, ReportDto } from "@dialindooh/shared";
import { screenScope, type AuthContext } from "@/server/auth";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { fillMonths } from "@/server/services/screenService";
import { getEffectiveScreenStatus, serializeScreen } from "@/server/utils/serializers";
import { reportQuerySchema } from "@/server/validation/schemas";

const REPORT_TIMEZONE = "America/Sao_Paulo";

export const reportService = {
  async buildReport(ctx: AuthContext, input: unknown): Promise<ReportDto> {
    const query = reportQuerySchema.parse(input);
    const from = new Date(`${query.from}T00:00:00-03:00`);
    const to = new Date(`${query.to}T23:59:59.999-03:00`);

    if (to < from) {
      throw new ApiError(422, "invalid_period", "A data final precisa ser depois da inicial.");
    }

    if (to.getTime() - from.getTime() > 400 * 24 * 60 * 60 * 1000) {
      throw new ApiError(422, "period_too_long", "O período máximo é de 13 meses.");
    }

    const screens = await prisma.screen.findMany({
      where: {
        ...screenScope(ctx),
        ...(query.screenId ? { id: query.screenId } : {})
      },
      select: { id: true, name: true }
    });
    const screenIds = screens.map((screen) => screen.id);

    const [media, playlist] = await Promise.all([
      query.mediaId
        ? prisma.media.findFirst({ where: { id: query.mediaId, OR: [{ accountId: ctx.accountId }, { isLibrary: true }] } })
        : null,
      query.playlistId
        ? prisma.playlist.findFirst({ where: { id: query.playlistId, OR: [{ accountId: ctx.accountId }, { isLibrary: true }] } })
        : null
    ]);

    if (query.mediaId && !media) throw new ApiError(404, "media_not_found", "Mídia não encontrada.");
    if (query.playlistId && !playlist) throw new ApiError(404, "playlist_not_found", "Grupo não encontrado.");

    const companyMediaIds = query.companyId
      ? (await prisma.media.findMany({ where: { companyId: query.companyId, accountId: ctx.accountId }, select: { id: true } })).map(
          (item) => item.id
        )
      : null;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`"startedAt" >= ${from}`,
      Prisma.sql`"startedAt" <= ${to}`,
      screenIds.length ? Prisma.sql`"screenId" IN (${Prisma.join(screenIds)})` : Prisma.sql`FALSE`
    ];

    if (query.mediaId) conditions.push(Prisma.sql`"mediaId" = ${query.mediaId}`);
    if (query.playlistId) conditions.push(Prisma.sql`"playlistId" = ${query.playlistId}`);
    if (companyMediaIds) {
      conditions.push(companyMediaIds.length ? Prisma.sql`"mediaId" IN (${Prisma.join(companyMediaIds)})` : Prisma.sql`FALSE`);
    }

    const where = Prisma.join(conditions, " AND ");

    const [perScreen, daily] = await Promise.all([
      prisma.$queryRaw<Array<{ screenId: string; plays: bigint; seconds: bigint | null; last: Date | null }>>`
        SELECT "screenId", COUNT(*)::bigint AS plays, SUM("durationSeconds")::bigint AS seconds, MAX("startedAt") AS last
        FROM "PlayLog" WHERE ${where}
        GROUP BY "screenId"
      `,
      prisma.$queryRaw<Array<{ day: string; plays: bigint }>>`
        SELECT to_char(("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${REPORT_TIMEZONE}, 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS plays
        FROM "PlayLog" WHERE ${where}
        GROUP BY 1 ORDER BY 1
      `
    ]);

    const names = new Map(screens.map((screen) => [screen.id, screen.name]));
    const rows = perScreen
      .map((row) => ({
        screenId: row.screenId,
        screenName: names.get(row.screenId) ?? "Tela removida",
        plays: Number(row.plays),
        seconds: Number(row.seconds ?? 0),
        lastPlayedAt: row.last ? new Date(row.last).toISOString() : null
      }))
      .sort((left, right) => right.plays - left.plays);

    const campaignStart = media?.scheduleStartsAt && media.scheduleStartsAt > from ? media.scheduleStartsAt : from;
    const campaignEnd = media?.scheduleEndsAt && media.scheduleEndsAt < to ? media.scheduleEndsAt : to;
    const campaignDays = Math.max(1, Math.round((campaignEnd.getTime() - campaignStart.getTime()) / (24 * 60 * 60 * 1000)));

    return {
      from: query.from,
      to: query.to,
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.user.name,
      mediaTitle: media?.title ?? null,
      playlistName: playlist?.name ?? null,
      totalPlays: rows.reduce((total, row) => total + row.plays, 0),
      totalSeconds: rows.reduce((total, row) => total + row.seconds, 0),
      campaignDays,
      screenCount: rows.length,
      rows,
      daily: daily.map((row) => ({ date: row.day, plays: Number(row.plays) }))
    };
  },

  async getDashboard(ctx: AuthContext): Promise<DashboardDto> {
    const scope = screenScope(ctx);
    const screens = await prisma.screen.findMany({
      where: scope,
      include: { company: true, items: { select: { id: true } } },
      orderBy: { name: "asc" }
    });
    const screenIds = screens.map((screen) => screen.id);
    const online = screens.filter((screen) => getEffectiveScreenStatus(screen.lastSeenAt) === "online").length;

    const since = new Date();
    since.setMonth(since.getMonth() - 11, 1);
    since.setHours(0, 0, 0, 0);
    const healthSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const idList = screenIds.length ? Prisma.join(screenIds) : null;

    const [monthly, top, health, mediaCount, playlistCount] = await Promise.all([
      idList
        ? prisma.$queryRaw<Array<{ month: string; plays: bigint }>>`
            SELECT to_char(date_trunc('month', "startedAt"), 'YYYY-MM') AS month, COUNT(*)::bigint AS plays
            FROM "PlayLog" WHERE "screenId" IN (${idList}) AND "startedAt" >= ${since}
            GROUP BY 1 ORDER BY 1`
        : [],
      idList
        ? prisma.$queryRaw<Array<{ screenId: string; plays: bigint }>>`
            SELECT "screenId", COUNT(*)::bigint AS plays FROM "PlayLog"
            WHERE "screenId" IN (${idList}) AND "startedAt" >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
            GROUP BY 1 ORDER BY 2 DESC LIMIT 5`
        : [],
      idList
        ? prisma.$queryRaw<Array<{ day: string; screens: bigint }>>`
            SELECT to_char("sentAt", 'YYYY-MM-DD') AS day, COUNT(DISTINCT "screenId")::bigint AS screens
            FROM "ScreenHeartbeat" WHERE "screenId" IN (${idList}) AND "sentAt" >= ${healthSince}
            GROUP BY 1 ORDER BY 1`
        : [],
      prisma.media.count({ where: { accountId: ctx.accountId } }),
      prisma.playlist.count({ where: { accountId: ctx.accountId } })
    ]);

    const monthlyPlays = fillMonths(since, monthly.map((row) => ({ month: row.month, plays: Number(row.plays) })));
    const names = new Map(screens.map((screen) => [screen.id, screen.name]));
    const healthByDay = new Map(health.map((row) => [row.day, Number(row.screens)]));
    const healthSeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const active = healthByDay.get(date) ?? 0;
      return { date, onlinePct: screens.length ? Math.round((active / screens.length) * 100) : 0 };
    });

    return {
      screens: { total: screens.length, online, offline: screens.length - online },
      monthlyPlays,
      playsThisMonth: monthlyPlays.at(-1)?.plays ?? 0,
      playsLastMonth: monthlyPlays.at(-2)?.plays ?? 0,
      health: healthSeries,
      topScreens: top.map((row) => ({ id: row.screenId, name: names.get(row.screenId) ?? "Tela", plays: Number(row.plays) })),
      favorites: screens
        .filter((screen) => screen.isFavorite)
        .map((screen) => serializeScreen({ ...screen, items: [] })) as unknown as DashboardDto["favorites"],
      mediaCount,
      playlistCount,
      notifications: buildNotifications(screens)
    };
  },

  async getNotifications(ctx: AuthContext) {
    const screens = await prisma.screen.findMany({ where: screenScope(ctx), include: { items: { select: { id: true } } } });
    const notifications = buildNotifications(screens);
    const expiring = await prisma.media.findMany({
      where: { accountId: ctx.accountId, type: "instagram" },
      select: { id: true, title: true, config: true }
    });

    for (const media of expiring) {
      const updatedAt = (media.config as Record<string, unknown> | null)?.tokenUpdatedAt as string | undefined;
      if (updatedAt && Date.now() - new Date(updatedAt).getTime() > 50 * 24 * 60 * 60 * 1000) {
        notifications.push({
          id: `instagram-${media.id}`,
          level: "warn",
          title: "Token do Instagram expirando",
          message: `Atualize o token de "${media.title}" para continuar exibindo as postagens.`,
          href: "/widgets/instagram",
          createdAt: new Date().toISOString()
        });
      }
    }

    return notifications;
  }
};

function buildNotifications(
  screens: Array<{ id: string; name: string; lastSeenAt: Date | null; deviceKeyHash: string | null; deviceKey: string | null; diagnostics: Prisma.JsonValue; items: Array<{ id: string }> }>
): NotificationDto[] {
  const notifications: NotificationDto[] = [];

  for (const screen of screens) {
    const paired = Boolean(screen.deviceKeyHash || screen.deviceKey);

    if (paired && getEffectiveScreenStatus(screen.lastSeenAt) === "offline") {
      notifications.push({
        id: `offline-${screen.id}`,
        level: "error",
        title: `${screen.name} está offline`,
        message: screen.lastSeenAt ? `Última comunicação em ${screen.lastSeenAt.toLocaleString("pt-BR", { timeZone: REPORT_TIMEZONE })}.` : "A tela nunca se comunicou.",
        href: `/screens/${screen.id}`,
        createdAt: (screen.lastSeenAt ?? new Date()).toISOString()
      });
    }

    if (paired && screen.items.length === 0) {
      notifications.push({
        id: `empty-${screen.id}`,
        level: "warn",
        title: `${screen.name} sem conteúdo`,
        message: "A lista de reprodução está vazia.",
        href: `/screens/${screen.id}`,
        createdAt: new Date().toISOString()
      });
    }

    const diagnostics = (screen.diagnostics ?? {}) as Record<string, number | null>;
    if (diagnostics.freeDiskBytes != null && diagnostics.freeDiskBytes < 500 * 1024 * 1024) {
      notifications.push({
        id: `disk-${screen.id}`,
        level: "warn",
        title: `${screen.name} com pouco espaço`,
        message: `Restam ${Math.round(diagnostics.freeDiskBytes / 1024 / 1024)} MB livres no aparelho.`,
        href: `/screens/${screen.id}`,
        createdAt: new Date().toISOString()
      });
    }
  }

  return notifications;
}
