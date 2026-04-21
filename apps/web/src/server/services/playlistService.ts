import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { serializePlaylist } from "@/server/utils/serializers";
import {
  playlistCreateSchema,
  playlistItemCreateSchema,
  playlistItemUpdateSchema,
  playlistItemsReorderSchema,
  playlistUpdateSchema
} from "@/server/validation/schemas";

const playlistInclude = {
  items: {
    orderBy: { order: "asc" as const },
    include: { media: true }
  }
};

export const playlistService = {
  async listPlaylists() {
    const playlists = await prisma.playlist.findMany({
      include: playlistInclude,
      orderBy: { createdAt: "desc" }
    });

    return playlists.map(serializePlaylist);
  },

  async createPlaylist(input: unknown) {
    const data = playlistCreateSchema.parse(input);
    const playlist = await prisma.playlist.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        scheduledStartAt: data.scheduledStartAt ? new Date(data.scheduledStartAt) : null,
        scheduledEndAt: data.scheduledEndAt ? new Date(data.scheduledEndAt) : null
      },
      include: playlistInclude
    });

    return serializePlaylist(playlist);
  },

  async getPlaylist(id: string) {
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: playlistInclude
    });

    if (!playlist) {
      throw new ApiError(404, "playlist_not_found", "Playlist was not found.");
    }

    return serializePlaylist(playlist);
  },

  async updatePlaylist(id: string, input: unknown) {
    const data = playlistUpdateSchema.parse(input);

    try {
      const playlist = await prisma.playlist.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          scheduledStartAt:
            data.scheduledStartAt === undefined ? undefined : data.scheduledStartAt ? new Date(data.scheduledStartAt) : null,
          scheduledEndAt:
            data.scheduledEndAt === undefined ? undefined : data.scheduledEndAt ? new Date(data.scheduledEndAt) : null
        },
        include: playlistInclude
      });

      return serializePlaylist(playlist);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new ApiError(404, "playlist_not_found", "Playlist was not found.");
      }

      throw error;
    }
  },

  async addItem(playlistId: string, input: unknown) {
    const data = playlistItemCreateSchema.parse(input);

    const playlist = await prisma.$transaction(async (tx) => {
      const [existingPlaylist, media] = await Promise.all([
        tx.playlist.findUnique({ where: { id: playlistId } }),
        tx.media.findUnique({ where: { id: data.mediaId } })
      ]);

      if (!existingPlaylist) {
        throw new ApiError(404, "playlist_not_found", "Playlist was not found.");
      }

      if (!media) {
        throw new ApiError(404, "media_not_found", "Media item was not found.");
      }

      assertPlaylistItemRules(media, data.displayDurationSeconds);

      const maxOrder = await tx.playlistItem.aggregate({
        where: { playlistId },
        _max: { order: true }
      });
      const appendOrder = (maxOrder._max.order ?? 0) + 1;
      const order = Math.min(data.order ?? appendOrder, appendOrder);
      const affectedItems = await tx.playlistItem.findMany({
        where: { playlistId, order: { gte: order } },
        orderBy: { order: "desc" }
      });

      for (const item of affectedItems) {
        await tx.playlistItem.update({
          where: { id: item.id },
          data: { order: item.order + 1 }
        });
      }

      await tx.playlistItem.create({
        data: {
          playlistId,
          mediaId: data.mediaId,
          order,
          displayDurationSeconds: media.type === "image" ? data.displayDurationSeconds : null
        }
      });

      return tx.playlist.findUniqueOrThrow({
        where: { id: playlistId },
        include: playlistInclude
      });
    });

    return serializePlaylist(playlist);
  },

  async reorderItems(playlistId: string, input: unknown) {
    const data = playlistItemsReorderSchema.parse(input);
    assertContiguousOrders(data.items.map((item) => item.order));

    const playlist = await prisma.$transaction(async (tx) => {
      const existingPlaylist = await tx.playlist.findUnique({ where: { id: playlistId } });

      if (!existingPlaylist) {
        throw new ApiError(404, "playlist_not_found", "Playlist was not found.");
      }

      const existingItems = await tx.playlistItem.findMany({
        where: { playlistId },
        orderBy: { order: "asc" }
      });
      const existingIds = new Set(existingItems.map((item) => item.id));
      const incomingIds = new Set(data.items.map((item) => item.id));

      if (existingItems.length !== data.items.length || incomingIds.size !== data.items.length) {
        throw new ApiError(422, "invalid_reorder", "Reorder payload must include each playlist item once.");
      }

      for (const item of data.items) {
        if (!existingIds.has(item.id)) {
          throw new ApiError(422, "invalid_reorder", "Reorder payload contains an item from another playlist.");
        }
      }

      for (let index = 0; index < existingItems.length; index += 1) {
        const existingItem = existingItems[index];

        if (!existingItem) {
          continue;
        }

        await tx.playlistItem.update({
          where: { id: existingItem.id },
          data: { order: -(index + 1) }
        });
      }

      for (const item of data.items) {
        await tx.playlistItem.update({
          where: { id: item.id },
          data: { order: item.order }
        });
      }

      return tx.playlist.findUniqueOrThrow({
        where: { id: playlistId },
        include: playlistInclude
      });
    });

    return serializePlaylist(playlist);
  },

  async deleteItem(playlistId: string, itemId: string) {
    const playlist = await prisma.$transaction(async (tx) => {
      const item = await tx.playlistItem.findFirst({
        where: { id: itemId, playlistId }
      });

      if (!item) {
        throw new ApiError(404, "playlist_item_not_found", "Playlist item was not found.");
      }

      await tx.playlistItem.delete({ where: { id: itemId } });

      const remainingItems = await tx.playlistItem.findMany({
        where: { playlistId },
        orderBy: { order: "asc" }
      });

      for (let index = 0; index < remainingItems.length; index += 1) {
        const nextOrder = index + 1;
        const remainingItem = remainingItems[index];

        if (remainingItem && remainingItem.order !== nextOrder) {
          await tx.playlistItem.update({
            where: { id: remainingItem.id },
            data: { order: nextOrder }
          });
        }
      }

      return tx.playlist.findUniqueOrThrow({
        where: { id: playlistId },
        include: playlistInclude
      });
    });

    return serializePlaylist(playlist);
  },

  async updateItem(playlistId: string, itemId: string, input: unknown) {
    const data = playlistItemUpdateSchema.parse(input);

    const playlist = await prisma.$transaction(async (tx) => {
      const item = await tx.playlistItem.findFirst({
        where: { id: itemId, playlistId },
        include: { media: true }
      });

      if (!item) {
        throw new ApiError(404, "playlist_item_not_found", "Playlist item was not found.");
      }

      if (item.media.type === "image" && !data.displayDurationSeconds) {
        throw new ApiError(422, "image_duration_required", "Images must define displayDurationSeconds.");
      }

      await tx.playlistItem.update({
        where: { id: itemId },
        data: {
          displayDurationSeconds: item.media.type === "image" ? data.displayDurationSeconds : null
        }
      });

      return tx.playlist.findUniqueOrThrow({
        where: { id: playlistId },
        include: playlistInclude
      });
    });

    return serializePlaylist(playlist);
  }
};

function assertPlaylistItemRules(
  media: { type: "image" | "video"; status?: string; durationSeconds: number | null },
  displayDurationSeconds?: number | null
) {
  if (media.status && media.status !== "ready") {
    throw new ApiError(422, "media_not_ready", "Only ready media can be added to playlists.");
  }

  if (media.type === "image" && !displayDurationSeconds) {
    throw new ApiError(
      422,
      "image_duration_required",
      "Images must define displayDurationSeconds when added to a playlist."
    );
  }

  if (media.type === "video" && !media.durationSeconds) {
    throw new ApiError(422, "video_duration_required", "Videos must have an intrinsic durationSeconds value.");
  }
}

function assertContiguousOrders(orders: number[]) {
  const sortedOrders = [...orders].sort((left, right) => left - right);

  for (let index = 0; index < sortedOrders.length; index += 1) {
    if (sortedOrders[index] !== index + 1) {
      throw new ApiError(422, "invalid_order", "Playlist item order must be contiguous starting at 1.");
    }
  }
}
