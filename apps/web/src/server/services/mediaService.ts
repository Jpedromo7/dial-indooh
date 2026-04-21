import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { serializeMedia } from "@/server/utils/serializers";
import { mediaCreateSchema, mediaUpdateSchema } from "@/server/validation/schemas";

export const mediaService = {
  async listMedia() {
    const media = await prisma.media.findMany({
      orderBy: { createdAt: "desc" }
    });

    return media.map(serializeMedia);
  },

  async createMedia(input: unknown) {
    const data = mediaCreateSchema.parse(input);

    assertMediaMetadata(data);

    const media = await prisma.media.create({
      data: {
        title: data.title,
        type: data.type,
        fileUrl: data.fileUrl,
        mimeType: data.mimeType,
        sizeBytes: BigInt(data.sizeBytes),
        durationSeconds: data.type === "video" ? data.durationSeconds : null,
        status: "ready",
        orientation: data.orientation ?? "auto",
        readyAt: new Date()
      }
    });

    return serializeMedia(media);
  },

  async updateMedia(id: string, input: unknown) {
    const data = mediaUpdateSchema.parse(input);

    try {
      const media = await prisma.media.update({
        where: { id },
        data
      });

      return serializeMedia(media);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new ApiError(404, "media_not_found", "Media item was not found.");
      }

      throw error;
    }
  },

  async deleteMedia(id: string) {
    const playlistUsageCount = await prisma.playlistItem.count({
      where: { mediaId: id }
    });

    if (playlistUsageCount > 0) {
      throw new ApiError(409, "media_in_use", "Media used by a playlist cannot be deleted.");
    }

    try {
      await prisma.media.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new ApiError(404, "media_not_found", "Media item was not found.");
      }

      throw error;
    }

    return { id };
  }
};

function assertMediaMetadata(data: {
  type: "image" | "video";
  mimeType: string;
  durationSeconds?: number | null;
}) {
  if (data.type === "image" && !data.mimeType.startsWith("image/")) {
    throw new ApiError(422, "invalid_media_type", "Image media must use an image MIME type.");
  }

  if (data.type === "video" && !data.mimeType.startsWith("video/")) {
    throw new ApiError(422, "invalid_media_type", "Video media must use a video MIME type.");
  }

  if (data.type === "video" && !data.durationSeconds) {
    throw new ApiError(422, "video_duration_required", "Video media requires durationSeconds.");
  }
}
