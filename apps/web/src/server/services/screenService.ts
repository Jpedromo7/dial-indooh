import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { serializePlaylist, serializeScreen, serializeScreenDetail } from "@/server/utils/serializers";
import {
  screenActivationSchema,
  screenCreateSchema,
  screenHeartbeatSchema,
  screenUpdateSchema
} from "@/server/validation/schemas";

const screenInclude = {
  assignments: {
    where: { isActive: true },
    orderBy: { assignedAt: "desc" as const },
    take: 1
  },
  heartbeats: {
    orderBy: { sentAt: "desc" as const },
    take: 1
  }
};

const playlistInclude = {
  items: {
    orderBy: { order: "asc" as const },
    include: { media: true }
  }
};

export const screenService = {
  async listScreens() {
    const screens = await prisma.screen.findMany({
      include: screenInclude,
      orderBy: { createdAt: "desc" }
    });

    return screens.map(serializeScreen);
  },

  async getScreen(id: string) {
    const screen = await prisma.screen.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { isActive: true },
          orderBy: { assignedAt: "desc" },
          take: 1,
          include: {
            playlist: {
              include: playlistInclude
            }
          }
        },
        heartbeats: {
          orderBy: { sentAt: "desc" },
          take: 1,
          include: {
            currentMedia: true
          }
        }
      }
    });

    if (!screen) {
      throw new ApiError(404, "screen_not_found", "Screen was not found.");
    }

    return serializeScreenDetail(screen);
  },

  async createScreen(input: unknown) {
    const data = screenCreateSchema.parse(input);
    const slug = data.slug ?? (await createUniqueSlug(slugify(data.name)));
    const activationCode = await createUniqueActivationCode();

    try {
      const screen = await prisma.screen.create({
        data: {
          name: data.name,
          slug,
          activationCode,
          location: data.location ?? null
        },
        include: screenInclude
      });

      return serializeScreen(screen);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "screen_conflict", "Screen slug or activation code already exists.");
      }

      throw error;
    }
  },

  async updateScreen(id: string, input: unknown) {
    const data = screenUpdateSchema.parse(input);
    const { playlistId, ...screenData } = data;

    const screen = await prisma.$transaction(async (tx) => {
      const existingScreen = await tx.screen.findUnique({ where: { id } });

      if (!existingScreen) {
        throw new ApiError(404, "screen_not_found", "Screen was not found.");
      }

      if (screenData.slug && screenData.slug !== existingScreen.slug) {
        const slugOwner = await tx.screen.findUnique({ where: { slug: screenData.slug } });

        if (slugOwner) {
          throw new ApiError(409, "screen_slug_exists", "Screen slug is already in use.");
        }
      }

      if (Object.keys(screenData).length > 0) {
        await tx.screen.update({
          where: { id },
          data: screenData
        });
      }

      if (playlistId !== undefined) {
        await tx.screenAssignment.updateMany({
          where: { screenId: id, isActive: true },
          data: { isActive: false }
        });

        if (playlistId) {
          const playlist = await tx.playlist.findUnique({ where: { id: playlistId } });

          if (!playlist || !playlist.isActive) {
            throw new ApiError(404, "playlist_not_found", "Active playlist was not found.");
          }

          await tx.screenAssignment.create({
            data: {
              screenId: id,
              playlistId,
              isActive: true
            }
          });
        }
      }

      return tx.screen.findUniqueOrThrow({
        where: { id },
        include: screenInclude
      });
    });

    return serializeScreen(screen);
  },

  async activateScreen(input: unknown) {
    const data = screenActivationSchema.parse(input);
    const screen = await prisma.screen.findUnique({
      where: { activationCode: data.activationCode }
    });

    if (!screen) {
      throw new ApiError(404, "activation_code_not_found", "Activation code was not found.");
    }

    if (screen.deviceKey) {
      return {
        screenId: screen.id,
        deviceKey: screen.deviceKey
      };
    }

    const updatedScreen = await attachUniqueDeviceKey(screen.id);

    if (!updatedScreen.deviceKey) {
      throw new ApiError(500, "device_key_generation_failed", "Could not generate a device key.");
    }

    return {
      screenId: updatedScreen.id,
      deviceKey: updatedScreen.deviceKey
    };
  },

  async getDevicePlaylist(screenId: string, deviceKey: string | null) {
    await assertDeviceAccess(screenId, deviceKey);

    const assignment = await prisma.screenAssignment.findFirst({
      where: {
        screenId,
        isActive: true,
        playlist: { isActive: true }
      },
      orderBy: { assignedAt: "desc" },
      include: {
        playlist: {
          include: playlistInclude
        }
      }
    });

    return {
      playlist: assignment ? serializePlaylist(assignment.playlist) : null
    };
  },

  async recordHeartbeat(screenId: string, deviceKey: string | null, input: unknown) {
    const data = screenHeartbeatSchema.parse(input);
    await assertDeviceAccess(screenId, deviceKey);

    const sentAt = data.sentAt ? new Date(data.sentAt) : new Date();
    const heartbeat = await prisma.$transaction(async (tx) => {
      if (data.currentMediaId) {
        const media = await tx.media.findUnique({ where: { id: data.currentMediaId } });

        if (!media) {
          throw new ApiError(404, "media_not_found", "Current media item was not found.");
        }
      }

      const createdHeartbeat = await tx.screenHeartbeat.create({
        data: {
          screenId,
          status: data.status,
          appVersion: data.appVersion ?? null,
          ipAddress: data.ipAddress ?? null,
          currentMediaId: data.currentMediaId ?? null,
          sentAt
        }
      });

      await tx.screen.update({
        where: { id: screenId },
        data: {
          status: data.status,
          lastSeenAt: sentAt
        }
      });

      return createdHeartbeat;
    });

    return heartbeat;
  }
};

async function assertDeviceAccess(screenId: string, deviceKey: string | null) {
  if (!deviceKey) {
    throw new ApiError(401, "device_key_required", "Device key is required.");
  }

  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: { id: true, deviceKey: true }
  });

  if (!screen) {
    throw new ApiError(404, "screen_not_found", "Screen was not found.");
  }

  if (!screen.deviceKey || screen.deviceKey !== deviceKey) {
    throw new ApiError(403, "invalid_device_key", "Device key is invalid for this screen.");
  }

  return screen;
}

async function attachUniqueDeviceKey(screenId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.screen.update({
        where: { id: screenId },
        data: {
          deviceKey: generateDeviceKey()
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }

      throw error;
    }
  }

  throw new ApiError(500, "device_key_generation_failed", "Could not generate a unique device key.");
}

async function createUniqueActivationCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const activationCode = generateActivationCode();
    const existingScreen = await prisma.screen.findUnique({
      where: { activationCode }
    });

    if (!existingScreen) {
      return activationCode;
    }
  }

  throw new ApiError(500, "activation_code_generation_failed", "Could not generate a unique activation code.");
}

async function createUniqueSlug(baseSlug: string) {
  let suffix = 1;
  const base = baseSlug || "screen";
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

  for (let index = 0; index < 6; index += 1) {
    const randomIndex = crypto.randomInt(0, alphabet.length);
    code += alphabet.charAt(randomIndex);
  }

  return code;
}

function generateDeviceKey() {
  return crypto.randomBytes(32).toString("base64url");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
