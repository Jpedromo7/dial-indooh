import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";

/**
 * Limite de tentativas por chave (ex.: "login:ip:1.2.3.4") em janela fixa, guardado no Postgres
 * para funcionar entre instâncias serverless.
 */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];

  if (row && row.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - now.getTime()) / 1000));
    throw new ApiError(429, "too_many_attempts", `Muitas tentativas. Tente novamente em ${formatWait(retryAfter)}.`, {
      retryAfter
    });
  }
}

export async function resetRateLimit(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

function formatWait(seconds: number) {
  if (seconds < 60) {
    return `${seconds} segundos`;
  }

  return `${Math.ceil(seconds / 60)} minutos`;
}
