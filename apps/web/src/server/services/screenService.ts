import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { assertScreenAllowed, screenScope, type AuthContext } from "@/server/auth";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { mediaVisibility } from "@/server/services/mediaService";
import { requirePublishedTvRelease } from "@/server/services/tvRelease";
import { assertStorageUrl } from "@/server/storage/mediaStorage";
import {
  serializeScreen,
  serializeScreenCommand,
  serializeScreenEvent,
  serializeScreenItem,
  serializeScreenMirrorCandidate,
  serializeScreenMirrorSession
} from "@/server/utils/serializers";
import {
  screenCommandCreateSchema,
  screenCreateSchema,
  screenItemCreateSchema,
  screenItemsReplaceSchema,
  screenMirrorCandidateCreateSchema,
  screenMirrorSessionUpdateSchema,
  screenUpdateSchema
} from "@/server/validation/schemas";

export const screenItemsInclude = {
  orderBy: { order: "asc" as const },
  include: {
    media: { include: { company: true } },
    playlist: { include: { items: { orderBy: { order: "asc" as const }, include: { media: true } } } }
  }
} satisfies Prisma.Screen$itemsArgs;

const screenListInclude = {
  company: true,
  items: screenItemsInclude
} satisfies Prisma.ScreenInclude;

export const screenService = {
  async listScreens(ctx: AuthContext, filters: { status?: string | null; q?: string | null; favorites?: boolean } = {}) {
    const screens = await prisma.screen.findMany({
      where: {
        ...screenScope(ctx),
        ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" as const } } : {}),
        ...(filters.favorites ? { isFavorite: true } : {})
      },
      include: screenListInclude,
      orderBy: [{ isFavorite: "desc" }, { name: "asc" }]
    });

    const serialized = screens.map(serializeScreen);
    return filters.status ? serialized.filter((screen) => screen.status === filters.status) : serialized;
  },

  async getScreen(ctx: AuthContext, id: string) {
    assertScreenAllowed(ctx, id);
    const screen = await prisma.screen.findFirst({
      where: { id, accountId: ctx.accountId },
      include: {
        ...screenListInclude,
        events: { orderBy: { createdAt: "desc" }, take: 12, include: { media: true } },
        commands: { orderBy: { requestedAt: "desc" }, take: 8 }
      }
    });

    if (!screen) {
      throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
    }

    const monthlyPlays = await getMonthlyPlays(id);
    const live = (screen.lastHeartbeat ?? null) as Record<string, unknown> | null;
    const currentMedia =
      typeof live?.currentMediaId === "string"
        ? await prisma.media.findUnique({ where: { id: live.currentMediaId } })
        : null;

    return {
      ...serializeScreen(screen),
      items: screen.items.map(serializeScreenItem),
      lastHeartbeat: live
        ? {
            screenId: screen.id,
            status: "online",
            appVersion: (live.appVersion as string | undefined) ?? null,
            ipAddress: (live.ipAddress as string | undefined) ?? null,
            currentMediaId: (live.currentMediaId as string | undefined) ?? null,
            currentPlaylistItemId: (live.currentPlaylistItemId as string | undefined) ?? null,
            playbackPositionSeconds: (live.playbackPositionSeconds as number | undefined) ?? null,
            playbackDurationSeconds: (live.playbackDurationSeconds as number | undefined) ?? null,
            playbackState: (live.playbackState as string | undefined) ?? null,
            sentAt: (live.sentAt as string | undefined) ?? screen.lastSeenAt?.toISOString() ?? null,
            currentMedia: currentMedia ? { ...currentMedia, sizeBytes: Number(currentMedia.sizeBytes) } : null
          }
        : null,
      recentEvents: screen.events.map(serializeScreenEvent),
      recentCommands: screen.commands.map(serializeScreenCommand),
      monthlyPlays
    };
  },

  async createScreen(ctx: AuthContext, input: unknown) {
    requireManager(ctx);
    const data = screenCreateSchema.parse(input);
    await assertScreenQuota(ctx.accountId);
    await assertCompany(ctx, data.companyId);
    assertStorageUrl(data.imageUrl, "imageUrl");

    const slug = data.slug ?? (await createUniqueSlug(slugify(data.name)));
    const activationCode = await createUniqueActivationCode();

    try {
      const screen = await prisma.screen.create({
        data: { ...data, slug, activationCode, accountId: ctx.accountId },
        include: screenListInclude
      });

      return serializeScreen(screen);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "screen_conflict", "Já existe uma tela com esse identificador.");
      }

      throw error;
    }
  },

  async updateScreen(ctx: AuthContext, id: string, input: unknown) {
    const data = screenUpdateSchema.parse(input);
    await getScopedScreen(ctx, id);
    const { playlistId, ...screenData } = data;

    if (!ctx.isAdmin) {
      // Operadores só ajustam favoritos, anotações e embaralhar.
      const allowed = ["isFavorite", "notes", "shuffle"];
      if (Object.keys(screenData).some((key) => !allowed.includes(key)) || playlistId !== undefined) {
        throw new ApiError(403, "forbidden", "Somente administradores alteram o cadastro da tela.");
      }
    }

    await assertCompany(ctx, screenData.companyId);
    assertStorageUrl(screenData.imageUrl, "imageUrl");

    if (screenData.slug) {
      const owner = await prisma.screen.findUnique({ where: { slug: screenData.slug } });
      if (owner && owner.id !== id) {
        throw new ApiError(409, "screen_slug_exists", "O identificador já está em uso.");
      }
    }

    const screen = await prisma.$transaction(async (tx) => {
      if (Object.keys(screenData).length > 0) {
        await tx.screen.update({ where: { id }, data: screenData });
      }

      // Compatibilidade com o painel antigo: "playlistId" substitui a lista pela playlist informada.
      if (playlistId !== undefined) {
        await tx.screenItem.deleteMany({ where: { screenId: id } });
        if (playlistId) {
          const playlist = await tx.playlist.findFirst({ where: { id: playlistId, OR: [{ accountId: ctx.accountId }, { isLibrary: true }] } });
          if (!playlist) throw new ApiError(404, "playlist_not_found", "Grupo não encontrado.");
          await tx.screenItem.create({ data: { screenId: id, playlistId, order: 1 } });
        }
      }

      return tx.screen.findUniqueOrThrow({ where: { id }, include: screenListInclude });
    });

    return serializeScreen(screen);
  },

  async deleteScreen(ctx: AuthContext, id: string) {
    requireManager(ctx);
    await getScopedScreen(ctx, id);
    await prisma.screen.delete({ where: { id } });
    return { id };
  },

  async duplicateScreen(ctx: AuthContext, id: string) {
    requireManager(ctx);
    await assertScreenQuota(ctx.accountId);
    const source = await prisma.screen.findFirst({ where: { id, accountId: ctx.accountId }, include: { items: true } });

    if (!source) {
      throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
    }

    const name = `${source.name} (cópia)`;
    const created = await prisma.$transaction(async (tx) => {
      const screen = await tx.screen.create({
        data: {
          accountId: source.accountId,
          companyId: source.companyId,
          name,
          slug: await createUniqueSlug(slugify(name)),
          activationCode: await createUniqueActivationCode(),
          location: source.location,
          imageUrl: source.imageUrl,
          segment: source.segment,
          street: source.street,
          streetNumber: source.streetNumber,
          complement: source.complement,
          zipCode: source.zipCode,
          district: source.district,
          state: source.state,
          city: source.city,
          phone1: source.phone1,
          phone2: source.phone2,
          openFrom: source.openFrom,
          openTo: source.openTo,
          openDays: source.openDays,
          footfall: source.footfall,
          socialClasses: source.socialClasses,
          refreshMinutes: source.refreshMinutes,
          soundEnabled: source.soundEnabled,
          timezone: source.timezone,
          footerEnabled: source.footerEnabled,
          shuffle: source.shuffle,
          orientation: source.orientation
        }
      });

      for (const item of source.items) {
        await tx.screenItem.create({
          data: {
            screenId: screen.id,
            order: item.order,
            mediaId: item.mediaId,
            playlistId: item.playlistId,
            durationSeconds: item.durationSeconds
          }
        });
      }

      return tx.screen.findUniqueOrThrow({ where: { id: screen.id }, include: screenListInclude });
    });

    return serializeScreen(created);
  },

  /** Gera novo código de ativação e desconecta a TV atual (ela volta para a tela de ativação). */
  async resetPairing(ctx: AuthContext, id: string) {
    requireManager(ctx);
    await getScopedScreen(ctx, id);
    const screen = await prisma.screen.update({
      where: { id },
      data: {
        activationCode: await createUniqueActivationCode(),
        deviceKey: null,
        deviceKeyHash: null,
        lastSeenAt: null,
        lastHeartbeat: Prisma.JsonNull,
        status: "offline"
      },
      include: screenListInclude
    });

    return serializeScreen(screen);
  },

  async replaceItems(ctx: AuthContext, id: string, input: unknown) {
    const data = screenItemsReplaceSchema.parse(input);
    await getScopedScreen(ctx, id);
    await assertItemTargets(ctx, data.items);

    await prisma.$transaction(async (tx) => {
      await tx.screenItem.deleteMany({ where: { screenId: id } });

      let order = 1;
      for (const item of data.items) {
        await tx.screenItem.create({
          data: {
            screenId: id,
            order,
            mediaId: item.mediaId ?? null,
            playlistId: item.playlistId ?? null,
            durationSeconds: item.durationSeconds ?? null
          }
        });
        order += 1;
      }

      await tx.screen.update({ where: { id }, data: { updatedAt: new Date() } });
    });

    return this.listItems(ctx, id);
  },

  async addItem(ctx: AuthContext, id: string, input: unknown) {
    const data = screenItemCreateSchema.parse(input);
    await getScopedScreen(ctx, id);
    await assertItemTargets(ctx, [data]);

    const last = await prisma.screenItem.findFirst({ where: { screenId: id }, orderBy: { order: "desc" } });
    await prisma.screenItem.create({
      data: {
        screenId: id,
        order: (last?.order ?? 0) + 1,
        mediaId: data.mediaId ?? null,
        playlistId: data.playlistId ?? null,
        durationSeconds: data.durationSeconds ?? null
      }
    });

    return this.listItems(ctx, id);
  },

  async removeItem(ctx: AuthContext, id: string, itemId: string) {
    await getScopedScreen(ctx, id);
    const removed = await prisma.screenItem.deleteMany({ where: { id: itemId, screenId: id } });

    if (removed.count === 0) {
      throw new ApiError(404, "screen_item_not_found", "Item não encontrado na lista da tela.");
    }

    return this.listItems(ctx, id);
  },

  async listItems(ctx: AuthContext, id: string) {
    await getScopedScreen(ctx, id);
    const items = await prisma.screenItem.findMany({ where: { screenId: id }, ...screenItemsInclude });
    return items.map(serializeScreenItem);
  },

  async listEvents(ctx: AuthContext, screenId: string) {
    await getScopedScreen(ctx, screenId);
    const events = await prisma.screenEvent.findMany({
      where: { screenId },
      include: { media: true },
      orderBy: { createdAt: "desc" },
      take: 80
    });

    return events.map(serializeScreenEvent);
  },

  async createCommand(ctx: AuthContext, screenId: string, input: unknown) {
    const data = screenCommandCreateSchema.parse(input);
    await getScopedScreen(ctx, screenId);
    // Atualização do app: o link/versão vêm sempre do APK publicado pelo superadmin, nunca do pedido.
    const payload = data.type === "update_app" ? { ...(await requirePublishedTvRelease()) } : data.payload;

    const command = await prisma.screenCommand.create({
      data: {
        screenId,
        requestedById: ctx.user.id,
        type: data.type,
        payload: toJson(payload)
      }
    });

    return serializeScreenCommand(command);
  },

  /* ---------- Espelhamento (lado do painel) ---------- */

  async createMirrorSession(ctx: AuthContext, screenId: string) {
    await getScopedScreen(ctx, screenId);

    const session = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.screenMirrorSession.create({
        data: { screenId, requestedById: ctx.user.id, status: "requested" }
      });

      await tx.screenCommand.create({
        data: {
          screenId,
          requestedById: ctx.user.id,
          type: "start_screen_mirror",
          payload: toJson({ sessionId: createdSession.id })
        }
      });

      return createdSession;
    });

    return serializeScreenMirrorSession(session);
  },

  async getMirrorSessionForAdmin(ctx: AuthContext, screenId: string, sessionId: string) {
    await getScopedScreen(ctx, screenId);
    return serializeScreenMirrorSession(await getMirrorSession(screenId, sessionId));
  },

  async updateMirrorSessionForAdmin(ctx: AuthContext, screenId: string, sessionId: string, input: unknown) {
    await getScopedScreen(ctx, screenId);
    const data = screenMirrorSessionUpdateSchema.parse(input);
    return serializeScreenMirrorSession(await updateMirrorSession(screenId, sessionId, data));
  },

  async stopMirrorSession(ctx: AuthContext, screenId: string, sessionId: string) {
    await getScopedScreen(ctx, screenId);
    await getMirrorSession(screenId, sessionId);

    const session = await prisma.$transaction(async (tx) => {
      const updatedSession = await tx.screenMirrorSession.update({
        where: { id: sessionId },
        data: { status: "ended", endedAt: new Date() }
      });

      await tx.screenCommand.create({
        data: {
          screenId,
          requestedById: ctx.user.id,
          type: "stop_screen_mirror",
          payload: toJson({ sessionId })
        }
      });

      return updatedSession;
    });

    return serializeScreenMirrorSession(session);
  },

  async listMirrorCandidatesForAdmin(ctx: AuthContext, screenId: string, sessionId: string) {
    await getScopedScreen(ctx, screenId);
    await getMirrorSession(screenId, sessionId);
    const candidates = await prisma.screenMirrorCandidate.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
    return candidates.map(serializeScreenMirrorCandidate);
  },

  async createMirrorCandidateForAdmin(ctx: AuthContext, screenId: string, sessionId: string, input: unknown) {
    await getScopedScreen(ctx, screenId);
    await getMirrorSession(screenId, sessionId);
    const data = screenMirrorCandidateCreateSchema.parse(input);

    if (data.peer !== "viewer") {
      throw new ApiError(400, "invalid_mirror_peer", "O painel só pode enviar candidatos como viewer.");
    }

    const candidate = await prisma.screenMirrorCandidate.create({
      data: { sessionId, peer: data.peer, candidate: toJson(data.candidate) ?? Prisma.JsonNull }
    });

    return serializeScreenMirrorCandidate(candidate);
  }
};

function requireManager(ctx: AuthContext) {
  if (!ctx.isAdmin) {
    throw new ApiError(403, "forbidden", "Somente administradores gerenciam telas.");
  }
}

export async function getScopedScreen(ctx: AuthContext, id: string) {
  assertScreenAllowed(ctx, id);
  const screen = await prisma.screen.findFirst({ where: { id, accountId: ctx.accountId } });

  if (!screen) {
    throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
  }

  return screen;
}

async function assertScreenQuota(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { maxScreens: true } });

  if (account?.maxScreens) {
    const count = await prisma.screen.count({ where: { accountId } });
    if (count >= account.maxScreens) {
      throw new ApiError(403, "screen_limit_reached", `Limite de ${account.maxScreens} telas do plano atingido.`);
    }
  }
}

async function assertCompany(ctx: AuthContext, companyId: string | null | undefined) {
  if (!companyId) {
    return;
  }

  const company = await prisma.company.findFirst({ where: { id: companyId, accountId: ctx.accountId } });

  if (!company) {
    throw new ApiError(404, "company_not_found", "Empresa não encontrada.");
  }
}

async function assertItemTargets(ctx: AuthContext, items: Array<{ mediaId?: string | null; playlistId?: string | null }>) {
  const mediaIds = [...new Set(items.map((item) => item.mediaId).filter((value): value is string => Boolean(value)))];
  const playlistIds = [...new Set(items.map((item) => item.playlistId).filter((value): value is string => Boolean(value)))];

  const [mediaCount, playlistCount] = await Promise.all([
    mediaIds.length ? prisma.media.count({ where: { id: { in: mediaIds }, ...mediaVisibility(ctx) } }) : 0,
    playlistIds.length
      ? prisma.playlist.count({ where: { id: { in: playlistIds }, OR: [{ accountId: ctx.accountId }, { isLibrary: true }] } })
      : 0
  ]);

  if (mediaCount !== mediaIds.length || playlistCount !== playlistIds.length) {
    throw new ApiError(404, "item_not_found", "Uma ou mais mídias/grupos não foram encontrados.");
  }
}

async function getMonthlyPlays(screenId: string) {
  const since = new Date();
  since.setMonth(since.getMonth() - 11, 1);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<Array<{ month: string; plays: bigint }>>`
    SELECT to_char(date_trunc('month', "startedAt"), 'YYYY-MM') AS month, COUNT(*)::bigint AS plays
    FROM "PlayLog"
    WHERE "screenId" = ${screenId} AND "startedAt" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `;

  return fillMonths(since, rows.map((row) => ({ month: row.month, plays: Number(row.plays) })));
}

export function fillMonths(since: Date, rows: Array<{ month: string; plays: number }>) {
  const byMonth = new Map(rows.map((row) => [row.month, row.plays]));
  const result: Array<{ month: string; plays: number }> = [];
  const cursor = new Date(since);

  for (let index = 0; index < 12; index += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    result.push({ month: key, plays: byMonth.get(key) ?? 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

export async function getMirrorSession(screenId: string, sessionId: string) {
  const session = await prisma.screenMirrorSession.findFirst({ where: { id: sessionId, screenId } });

  if (!session) {
    throw new ApiError(404, "screen_mirror_session_not_found", "Sessão de espelhamento não encontrada.");
  }

  return session;
}

export async function updateMirrorSession(
  screenId: string,
  sessionId: string,
  data: {
    status?: "requested" | "connecting" | "active" | "ended" | "failed";
    offer?: Record<string, unknown> | null;
    answer?: Record<string, unknown> | null;
    errorMessage?: string | null;
  }
) {
  const session = await getMirrorSession(screenId, sessionId);
  const shouldEnd = data.status === "ended" || data.status === "failed";

  return prisma.screenMirrorSession.update({
    where: { id: session.id },
    data: {
      status: data.status,
      offer: data.offer === undefined ? undefined : toJson(data.offer),
      answer: data.answer === undefined ? undefined : toJson(data.answer),
      errorMessage: data.errorMessage === undefined ? undefined : data.errorMessage,
      endedAt: shouldEnd ? new Date() : undefined
    }
  });
}

export function toJson(value: Record<string, unknown> | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

async function createUniqueActivationCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const activationCode = generateActivationCode();
    const existingScreen = await prisma.screen.findUnique({ where: { activationCode } });

    if (!existingScreen) {
      return activationCode;
    }
  }

  throw new ApiError(500, "activation_code_generation_failed", "Não foi possível gerar um código de ativação único.");
}

async function createUniqueSlug(baseSlug: string) {
  let suffix = 1;
  const base = baseSlug || "tela";
  let candidate = base;

  while (await prisma.screen.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

function generateActivationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 8; index += 1) {
    code += alphabet.charAt(crypto.randomInt(0, alphabet.length));
  }

  return code;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
