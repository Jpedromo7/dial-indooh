import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";

export interface TvRelease {
  versionCode: number;
  url: string;
}

const CACHE_MS = 60 * 1000;
let cached: { at: number; value: TvRelease | null } | null = null;

/**
 * Versão do app da TV publicada no painel (Configurações > Aplicativo da TV, conta raiz).
 * TVs com versionCode menor baixam e instalam este APK sozinhas.
 */
export async function getPublishedTvRelease(): Promise<TvRelease | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.value;
  }

  const account = await prisma.account
    .findFirst({
      where: { parentId: null, apkUrl: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { apkUrl: true, apkVersionCode: true }
    })
    .catch(() => null);

  const value = account?.apkUrl && account.apkVersionCode ? { versionCode: account.apkVersionCode, url: account.apkUrl } : null;
  cached = { at: Date.now(), value };
  return value;
}

export async function requirePublishedTvRelease() {
  const release = await getPublishedTvRelease();

  if (!release) {
    throw new ApiError(
      409,
      "tv_release_not_configured",
      "Configure o link e a versão do APK em Configurações > Aplicativo da TV antes de atualizar."
    );
  }

  return release;
}

export function clearTvReleaseCache() {
  cached = null;
}
