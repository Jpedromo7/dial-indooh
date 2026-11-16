import { Prisma, type MediaType } from "@prisma/client";
import { extractYoutubeId } from "@dialindooh/shared";
import { screenScope, type AuthContext } from "@/server/auth";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { assertStorageUrl } from "@/server/storage/mediaStorage";
import { serializeMedia } from "@/server/utils/serializers";
import {
  clockConfigSchema,
  currencyConfigSchema,
  instagramConfigSchema,
  mediaCreateSchema,
  mediaUpdateSchema,
  noticeConfigSchema,
  rssConfigSchema,
  urlConfigSchema,
  weatherConfigSchema,
  youtubeConfigSchema
} from "@/server/validation/schemas";
import type { z } from "zod";

type MediaCreateInput = z.infer<typeof mediaCreateSchema>;
type ScheduleInput = NonNullable<MediaCreateInput["schedule"]>;

const mediaInclude = {
  company: true,
  _count: { select: { screenItems: true } }
} satisfies Prisma.MediaInclude;

const FILE_TYPES: MediaType[] = ["image", "video"];

export function mediaVisibility(ctx: AuthContext): Prisma.MediaWhereInput {
  return { OR: [{ accountId: ctx.accountId }, { isLibrary: true }] };
}

export const mediaService = {
  async listMedia(ctx: AuthContext, filters: { type?: string | null; companyId?: string | null; q?: string | null; library?: boolean } = {}) {
    const where: Prisma.MediaWhereInput = filters.library
      ? { isLibrary: true }
      : { accountId: ctx.accountId, isLibrary: false };

    if (filters.type) {
      where.type = filters.type as MediaType;
    }

    if (filters.companyId) {
      where.companyId = filters.companyId;
    }

    if (filters.q) {
      where.title = { contains: filters.q, mode: "insensitive" };
    }

    const media = await prisma.media.findMany({
      where,
      include: mediaInclude,
      orderBy: { createdAt: "desc" },
      take: 1000
    });

    return media.map(serializeMedia);
  },

  async getMedia(ctx: AuthContext, id: string) {
    const media = await prisma.media.findFirst({ where: { id, ...mediaVisibility(ctx) }, include: mediaInclude });

    if (!media) {
      throw new ApiError(404, "media_not_found", "Mídia não encontrada.");
    }

    return serializeMedia(media);
  },

  async createMedia(ctx: AuthContext, input: unknown) {
    const data = mediaCreateSchema.parse(input);
    const prepared = await prepareMediaData(ctx, data.type, data, null);

    if (data.isLibrary && !ctx.isSuperadmin) {
      throw new ApiError(403, "forbidden", "Somente o administrador da plataforma publica na biblioteca.");
    }

    const media = await prisma.$transaction(async (tx) => {
      const created = await tx.media.create({
        data: {
          ...prepared,
          accountId: ctx.accountId,
          title: data.title,
          type: data.type,
          isLibrary: data.isLibrary ?? false,
          status: "ready",
          readyAt: new Date()
        }
      });

      if (data.screenIds?.length) {
        await appendToScreens(tx, ctx, data.screenIds, { mediaId: created.id });
      }

      return tx.media.findUniqueOrThrow({ where: { id: created.id }, include: mediaInclude });
    });

    return serializeMedia(media);
  },

  async updateMedia(ctx: AuthContext, id: string, input: unknown) {
    const data = mediaUpdateSchema.parse(input);
    const existing = await getOwnedMedia(ctx, id);
    const prepared = await prepareMediaData(ctx, existing.type, data, existing);

    const media = await prisma.$transaction(async (tx) => {
      await tx.media.update({
        where: { id },
        data: { ...prepared, title: data.title ?? undefined }
      });

      if (data.screenIds) {
        await syncMediaScreens(tx, ctx, id, data.screenIds);
      }

      return tx.media.findUniqueOrThrow({ where: { id }, include: mediaInclude });
    });

    return serializeMedia(media);
  },

  async getMediaScreenIds(ctx: AuthContext, id: string) {
    await getOwnedMedia(ctx, id);
    const items = await prisma.screenItem.findMany({
      where: { mediaId: id, screen: screenScope(ctx) },
      select: { screenId: true },
      distinct: ["screenId"]
    });
    return items.map((item) => item.screenId);
  },

  async includeInScreens(ctx: AuthContext, id: string, screenIds: string[]) {
    await prisma.media.findFirstOrThrow({ where: { id, ...mediaVisibility(ctx) } }).catch(() => {
      throw new ApiError(404, "media_not_found", "Mídia não encontrada.");
    });
    await prisma.$transaction((tx) => appendToScreens(tx, ctx, screenIds, { mediaId: id }));
    return { id, screenIds };
  },

  async deleteMedia(ctx: AuthContext, id: string) {
    await getOwnedMedia(ctx, id);

    const groupUsage = await prisma.playlistItem.count({ where: { mediaId: id } });

    if (groupUsage > 0) {
      throw new ApiError(409, "media_in_use", "A mídia está em um ou mais grupos. Remova dos grupos antes de excluir.");
    }

    await prisma.media.delete({ where: { id } });
    return { id };
  },

  async deleteMany(ctx: AuthContext, ids: string[]) {
    const owned = await prisma.media.findMany({
      where: { id: { in: ids }, accountId: ctx.accountId },
      select: { id: true, _count: { select: { playlistItems: true } } }
    });
    const deletable = owned.filter((media) => media._count.playlistItems === 0).map((media) => media.id);

    await prisma.media.deleteMany({ where: { id: { in: deletable } } });

    return { deleted: deletable, skipped: ids.filter((id) => !deletable.includes(id)) };
  }
};

async function getOwnedMedia(ctx: AuthContext, id: string) {
  const media = await prisma.media.findFirst({
    where: ctx.isSuperadmin ? { id, OR: [{ accountId: ctx.accountId }, { isLibrary: true }] } : { id, accountId: ctx.accountId }
  });

  if (!media) {
    throw new ApiError(404, "media_not_found", "Mídia não encontrada.");
  }

  return media;
}

type MediaInput = Partial<Omit<MediaCreateInput, "type">>;

async function prepareMediaData(
  ctx: AuthContext,
  type: MediaType,
  data: MediaInput,
  existing: { config: Prisma.JsonValue; fileUrl: string; fileUrlVertical: string | null } | null
): Promise<Prisma.MediaUncheckedUpdateInput & Prisma.MediaUncheckedCreateInput> {
  const result: Record<string, unknown> = {};

  if (data.companyId !== undefined) {
    if (data.companyId) {
      const company = await prisma.company.findFirst({ where: { id: data.companyId, accountId: ctx.accountId } });
      if (!company) throw new ApiError(404, "company_not_found", "Empresa não encontrada.");
    }
    result.companyId = data.companyId;
  }

  if (data.category !== undefined) result.category = data.category;
  if (data.recordStats !== undefined) result.recordStats = data.recordStats;
  if (data.orientation !== undefined) result.orientation = data.orientation;
  if (data.rotationDegrees !== undefined) result.rotationDegrees = data.rotationDegrees;
  if (data.durationSeconds !== undefined) result.durationSeconds = data.durationSeconds;
  if (data.thumbnailUrl !== undefined) {
    assertStorageUrl(data.thumbnailUrl, "thumbnailUrl");
    result.thumbnailUrl = data.thumbnailUrl;
  }
  if (data.isLibrary !== undefined && ctx.isSuperadmin) result.isLibrary = data.isLibrary;

  if (data.schedule !== undefined) {
    Object.assign(result, scheduleToColumns(data.schedule));
  }

  if (FILE_TYPES.includes(type)) {
    if (data.fileUrl !== undefined) {
      assertStorageUrl(data.fileUrl);
      result.fileUrl = data.fileUrl ?? "";
    }
    if (data.fileUrlVertical !== undefined) {
      assertStorageUrl(data.fileUrlVertical, "fileUrlVertical");
      result.fileUrlVertical = data.fileUrlVertical;
    }
    if (data.mimeType !== undefined) result.mimeType = data.mimeType ?? "";
    if (data.sizeBytes !== undefined) result.sizeBytes = BigInt(data.sizeBytes ?? 0);
    if (data.sizeBytesVertical !== undefined) {
      result.sizeBytesVertical = data.sizeBytesVertical === null ? null : BigInt(data.sizeBytesVertical ?? 0);
    }

    const fileUrl = (result.fileUrl as string | undefined) ?? existing?.fileUrl ?? "";
    const fileUrlVertical = (result.fileUrlVertical as string | null | undefined) ?? existing?.fileUrlVertical ?? null;

    if (!fileUrl && !fileUrlVertical) {
      throw new ApiError(422, "file_required", "Envie o arquivo horizontal ou vertical.");
    }

    if (!existing && data.mimeType) {
      const expectedPrefix = type === "video" ? "video/" : "image/";
      if (!data.mimeType.startsWith(expectedPrefix)) {
        throw new ApiError(422, "unsupported_media_type", "O tipo do arquivo não corresponde à mídia.");
      }
    }

    return result as never;
  }

  if (data.config !== undefined && data.config !== null) {
    result.config = await parseWidgetConfig(type, data.config, existing?.config ?? null) as Prisma.InputJsonValue;
  } else if (!existing) {
    result.config = (await parseWidgetConfig(type, {}, null)) as Prisma.InputJsonValue;
  }

  if (type === "youtube" && result.config) {
    result.fileUrl = "";
  }

  return result as never;
}

async function parseWidgetConfig(type: MediaType, config: Record<string, unknown>, previous: Prisma.JsonValue) {
  const previousConfig = (previous ?? {}) as Record<string, unknown>;

  switch (type) {
    case "clock": {
      const parsed = clockConfigSchema.parse(config);
      assertStorageUrl(parsed.logoUrl, "logoUrl");
      return parsed;
    }
    case "currency":
      return currencyConfigSchema.parse(config);
    case "weather":
      return weatherConfigSchema.parse(config);
    case "rss": {
      const parsed = rssConfigSchema.parse(config);
      assertStorageUrl(parsed.logoUrl, "logoUrl");
      return parsed;
    }
    case "notice": {
      const parsed = noticeConfigSchema.parse(config);
      assertStorageUrl(parsed.imageUrl, "imageUrl");
      return parsed;
    }
    case "instagram": {
      const parsed = instagramConfigSchema.parse(config);
      assertStorageUrl(parsed.profileImageUrl, "profileImageUrl");
      const accessToken = parsed.accessToken ?? (previousConfig.accessToken as string | undefined);

      if (!accessToken) {
        throw new ApiError(422, "instagram_token_required", "Informe o token de acesso do Instagram.");
      }

      return { ...parsed, accessToken, tokenUpdatedAt: parsed.accessToken ? new Date().toISOString() : previousConfig.tokenUpdatedAt };
    }
    case "youtube": {
      const parsed = youtubeConfigSchema.parse(config);
      const videoId = extractYoutubeId(parsed.url);

      if (!videoId) {
        throw new ApiError(422, "invalid_youtube_url", "Link do YouTube inválido.");
      }

      return { url: parsed.url, videoId };
    }
    case "url":
      return urlConfigSchema.parse(config);
    default:
      throw new ApiError(422, "invalid_media_type", "Tipo de mídia inválido.");
  }
}

export function scheduleToColumns(schedule: ScheduleInput | null) {
  return {
    scheduleStartsAt: schedule?.startsAt ? new Date(schedule.startsAt) : null,
    scheduleEndsAt: schedule?.endsAt ? new Date(schedule.endsAt) : null,
    scheduleTimeFrom: schedule?.timeFrom || null,
    scheduleTimeTo: schedule?.timeTo || null,
    scheduleWeekdays: schedule?.weekdays ?? []
  };
}

/** Adiciona uma mídia ou grupo ao fim da lista de cada tela informada (ignora telas fora do escopo). */
export async function appendToScreens(
  tx: Prisma.TransactionClient,
  ctx: AuthContext,
  screenIds: string[],
  target: { mediaId?: string; playlistId?: string }
) {
  const screens = await tx.screen.findMany({
    where: { id: { in: screenIds }, ...screenScope(ctx) },
    select: { id: true, items: { select: { order: true, mediaId: true, playlistId: true }, orderBy: { order: "desc" } } }
  });

  for (const screen of screens) {
    const alreadyThere = screen.items.some(
      (item) =>
        (target.mediaId && item.mediaId === target.mediaId) || (target.playlistId && item.playlistId === target.playlistId)
    );

    if (alreadyThere) {
      continue;
    }

    await tx.screenItem.create({
      data: {
        screenId: screen.id,
        order: (screen.items[0]?.order ?? 0) + 1,
        mediaId: target.mediaId ?? null,
        playlistId: target.playlistId ?? null
      }
    });
  }
}

/** Deixa a mídia exatamente nas telas informadas (adiciona nas novas e remove das que saíram). */
export async function syncMediaScreens(tx: Prisma.TransactionClient, ctx: AuthContext, mediaId: string, screenIds: string[]) {
  await tx.screenItem.deleteMany({
    where: { mediaId, screenId: { notIn: screenIds }, screen: screenScope(ctx) }
  });
  await appendToScreens(tx, ctx, screenIds, { mediaId });
}

export async function syncPlaylistScreens(tx: Prisma.TransactionClient, ctx: AuthContext, playlistId: string, screenIds: string[]) {
  await tx.screenItem.deleteMany({
    where: { playlistId, screenId: { notIn: screenIds }, screen: screenScope(ctx) }
  });
  await appendToScreens(tx, ctx, screenIds, { playlistId });
}
