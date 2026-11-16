import { prisma } from "@/server/db";
import { ApiError, apiRoute } from "@/server/http";
import { refreshInstagramToken } from "@/server/services/externalData";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEARTBEAT_RETENTION_DAYS = Number(process.env.HEARTBEAT_RETENTION_DAYS ?? 30);
const EVENT_RETENTION_DAYS = Number(process.env.EVENT_RETENTION_DAYS ?? 60);
const PLAYLOG_RETENTION_DAYS = Number(process.env.PLAYLOG_RETENTION_DAYS ?? 400);

/** Rotina diária: retenção de logs, limpeza de comandos/sessões e renovação de tokens do Instagram. */
export const GET = apiRoute(async (request) => {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    throw new ApiError(401, "unauthorized", "Não autorizado.");
  }

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const [heartbeats, events, plays, commands, mirrors, limits] = await Promise.all([
    prisma.screenHeartbeat.deleteMany({ where: { sentAt: { lt: new Date(now - HEARTBEAT_RETENTION_DAYS * day) } } }),
    prisma.screenEvent.deleteMany({ where: { createdAt: { lt: new Date(now - EVENT_RETENTION_DAYS * day) } } }),
    prisma.playLog.deleteMany({ where: { startedAt: { lt: new Date(now - PLAYLOG_RETENTION_DAYS * day) } } }),
    prisma.screenCommand.deleteMany({ where: { requestedAt: { lt: new Date(now - 30 * day) } } }),
    prisma.screenMirrorSession.deleteMany({ where: { createdAt: { lt: new Date(now - 7 * day) } } }),
    prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now) } } })
  ]);

  let instagramRefreshed = 0;
  const instagram = await prisma.media.findMany({ where: { type: "instagram" }, select: { id: true, config: true } });

  for (const media of instagram) {
    const config = (media.config ?? {}) as Record<string, unknown>;
    const token = config.accessToken as string | undefined;
    const updatedAt = config.tokenUpdatedAt ? new Date(config.tokenUpdatedAt as string).getTime() : 0;

    if (!token || now - updatedAt < 20 * day) {
      continue;
    }

    try {
      const refreshed = await refreshInstagramToken(token);
      await prisma.media.update({
        where: { id: media.id },
        data: { config: { ...config, accessToken: refreshed.access_token, tokenUpdatedAt: new Date().toISOString() } }
      });
      instagramRefreshed += 1;
    } catch (error) {
      console.warn(`Falha ao renovar token do Instagram da mídia ${media.id}`, error);
    }
  }

  return {
    deleted: {
      heartbeats: heartbeats.count,
      events: events.count,
      plays: plays.count,
      commands: commands.count,
      mirrorSessions: mirrors.count,
      rateLimits: limits.count
    },
    instagramRefreshed
  };
});
