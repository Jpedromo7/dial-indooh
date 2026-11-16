import type { Prisma } from "@prisma/client";
import type { AuthContext } from "@/server/auth";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { assertStorageUrl } from "@/server/storage/mediaStorage";
import { appendToScreens, mediaVisibility, syncPlaylistScreens } from "@/server/services/mediaService";
import { screenScope } from "@/server/auth";
import { serializePlaylist } from "@/server/utils/serializers";
import { playlistCreateSchema, playlistUpdateSchema } from "@/server/validation/schemas";

const playlistInclude = {
  items: { orderBy: { order: "asc" as const }, include: { media: true } },
  _count: { select: { screenItems: true } }
} satisfies Prisma.PlaylistInclude;

/** Grupos: conjuntos ordenados de mídias que entram na lista de uma tela como um único item. */
export const playlistService = {
  async listPlaylists(ctx: AuthContext, options: { library?: boolean } = {}) {
    const playlists = await prisma.playlist.findMany({
      where: options.library ? { isLibrary: true } : { accountId: ctx.accountId, isLibrary: false },
      include: playlistInclude,
      orderBy: { createdAt: "desc" }
    });

    return playlists.map(serializePlaylist);
  },

  async getPlaylist(ctx: AuthContext, id: string) {
    const playlist = await prisma.playlist.findFirst({
      where: { id, OR: [{ accountId: ctx.accountId }, { isLibrary: true }] },
      include: playlistInclude
    });

    if (!playlist) {
      throw new ApiError(404, "playlist_not_found", "Grupo não encontrado.");
    }

    return serializePlaylist(playlist);
  },

  async getPlaylistScreenIds(ctx: AuthContext, id: string) {
    const items = await prisma.screenItem.findMany({
      where: { playlistId: id, screen: screenScope(ctx) },
      select: { screenId: true },
      distinct: ["screenId"]
    });
    return items.map((item) => item.screenId);
  },

  async createPlaylist(ctx: AuthContext, input: unknown) {
    const data = playlistCreateSchema.parse(input);
    assertStorageUrl(data.imageUrl, "imageUrl");

    if (data.isLibrary && !ctx.isSuperadmin) {
      throw new ApiError(403, "forbidden", "Somente o administrador da plataforma publica na biblioteca.");
    }

    const playlist = await prisma.$transaction(async (tx) => {
      const created = await tx.playlist.create({
        data: {
          accountId: ctx.accountId,
          name: data.name,
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          category: data.category ?? null,
          isLibrary: data.isLibrary ?? false,
          isActive: data.isActive ?? true,
          scheduledStartAt: data.scheduledStartAt ? new Date(data.scheduledStartAt) : null,
          scheduledEndAt: data.scheduledEndAt ? new Date(data.scheduledEndAt) : null
        }
      });

      if (data.mediaIds) {
        await replaceItems(tx, ctx, created.id, data.mediaIds);
      }

      if (data.screenIds?.length) {
        await appendToScreens(tx, ctx, data.screenIds, { playlistId: created.id });
      }

      return tx.playlist.findUniqueOrThrow({ where: { id: created.id }, include: playlistInclude });
    });

    return serializePlaylist(playlist);
  },

  async updatePlaylist(ctx: AuthContext, id: string, input: unknown) {
    const data = playlistUpdateSchema.parse(input);
    await getOwnedPlaylist(ctx, id);
    assertStorageUrl(data.imageUrl, "imageUrl");

    const playlist = await prisma.$transaction(async (tx) => {
      await tx.playlist.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          imageUrl: data.imageUrl,
          category: data.category,
          isActive: data.isActive,
          isLibrary: ctx.isSuperadmin ? data.isLibrary : undefined,
          scheduledStartAt:
            data.scheduledStartAt === undefined ? undefined : data.scheduledStartAt ? new Date(data.scheduledStartAt) : null,
          scheduledEndAt:
            data.scheduledEndAt === undefined ? undefined : data.scheduledEndAt ? new Date(data.scheduledEndAt) : null
        }
      });

      if (data.mediaIds) {
        await replaceItems(tx, ctx, id, data.mediaIds);
      }

      if (data.screenIds) {
        await syncPlaylistScreens(tx, ctx, id, data.screenIds);
      }

      return tx.playlist.findUniqueOrThrow({ where: { id }, include: playlistInclude });
    });

    return serializePlaylist(playlist);
  },

  async includeInScreens(ctx: AuthContext, id: string, screenIds: string[]) {
    await this.getPlaylist(ctx, id);
    await prisma.$transaction((tx) => appendToScreens(tx, ctx, screenIds, { playlistId: id }));
    return { id, screenIds };
  },

  async deletePlaylist(ctx: AuthContext, id: string) {
    await getOwnedPlaylist(ctx, id);
    await prisma.$transaction(async (tx) => {
      await tx.screenAssignment.deleteMany({ where: { playlistId: id } });
      await tx.playlist.delete({ where: { id } });
    });
    return { id };
  }
};

async function getOwnedPlaylist(ctx: AuthContext, id: string) {
  const playlist = await prisma.playlist.findFirst({
    where: ctx.isSuperadmin ? { id, OR: [{ accountId: ctx.accountId }, { isLibrary: true }] } : { id, accountId: ctx.accountId }
  });

  if (!playlist) {
    throw new ApiError(404, "playlist_not_found", "Grupo não encontrado.");
  }

  return playlist;
}

async function replaceItems(tx: Prisma.TransactionClient, ctx: AuthContext, playlistId: string, mediaIds: string[]) {
  const uniqueIds = [...new Set(mediaIds)];
  const media = await tx.media.findMany({
    where: { id: { in: uniqueIds }, ...mediaVisibility(ctx) },
    select: { id: true, type: true }
  });
  const allowed = new Set(media.map((item) => item.id));
  const missing = uniqueIds.filter((mediaId) => !allowed.has(mediaId));

  if (missing.length > 0) {
    throw new ApiError(404, "media_not_found", "Uma ou mais mídias não foram encontradas.");
  }

  await tx.playlistItem.deleteMany({ where: { playlistId } });

  let order = 1;
  for (const mediaId of mediaIds) {
    await tx.playlistItem.create({ data: { playlistId, mediaId, order } });
    order += 1;
  }
}
