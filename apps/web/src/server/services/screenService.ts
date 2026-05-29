import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import {
  serializePlaylist,
  serializeScreen,
  serializeScreenCommand,
  serializeScreenDetail,
  serializeScreenEvent,
  serializeScreenMirrorCandidate,
  serializeScreenMirrorSession
} from "@/server/utils/serializers";
import {
  screenCommandAckSchema,
  screenCommandCreateSchema,
  screenMirrorCandidateCreateSchema,
  screenMirrorSessionUpdateSchema,
  screenActivationSchema,
  screenCreateSchema,
  screenEventSchema,
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

const devicePlaylistInclude = {
  items: {
    where: {
      media: {
        status: "ready" as const
      }
    },
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
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 12,
          include: {
            media: true
          }
        },
        commands: {
          orderBy: { requestedAt: "desc" },
          take: 8
        }
      }
    });

    if (!screen) {
      throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
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
          location: data.location ?? null,
          orientation: data.orientation ?? "landscape"
        },
        include: screenInclude
      });

      return serializeScreen(screen);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "screen_conflict", "Slug ou código de ativação da tela já existe.");
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
        throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
      }

      if (screenData.slug && screenData.slug !== existingScreen.slug) {
        const slugOwner = await tx.screen.findUnique({ where: { slug: screenData.slug } });

        if (slugOwner) {
          throw new ApiError(409, "screen_slug_exists", "O slug da tela já está em uso.");
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
            throw new ApiError(404, "playlist_not_found", "Playlist ativa não encontrada.");
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

  async deleteScreen(id: string) {
    try {
      await prisma.screen.delete({
        where: { id }
      });

      return { id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
      }

      throw error;
    }
  },

  async activateScreen(input: unknown) {
    const data = screenActivationSchema.parse(input);
    const screen = await prisma.screen.findUnique({
      where: { activationCode: data.activationCode }
    });

    if (!screen) {
      throw new ApiError(404, "activation_code_not_found", "Código de ativação não encontrado.");
    }

    if (screen.deviceKey) {
      return {
        screenId: screen.id,
        deviceKey: screen.deviceKey
      };
    }

    const updatedScreen = await attachUniqueDeviceKey(screen.id);

    if (!updatedScreen.deviceKey) {
      throw new ApiError(500, "device_key_generation_failed", "Não foi possível gerar a chave do dispositivo.");
    }

    return {
      screenId: updatedScreen.id,
      deviceKey: updatedScreen.deviceKey
    };
  },

  async getDevicePlaylist(screenId: string, deviceKey: string | null) {
    const screen = await assertDeviceAccess(screenId, deviceKey);
    const now = new Date();

    const assignment = await prisma.screenAssignment.findFirst({
      where: {
        screenId,
        isActive: true,
        playlist: {
          isActive: true,
          AND: [
            { OR: [{ scheduledStartAt: null }, { scheduledStartAt: { lte: now } }] },
            { OR: [{ scheduledEndAt: null }, { scheduledEndAt: { gte: now } }] }
          ]
        }
      },
      orderBy: { assignedAt: "desc" },
      include: {
        playlist: {
          include: devicePlaylistInclude
        }
      }
    });

    return {
      screenOrientation: screen.orientation,
      playlist: assignment ? serializePlaylist(assignment.playlist) : null
    };
  },

  async listEvents(screenId: string) {
    const screen = await prisma.screen.findUnique({ where: { id: screenId }, select: { id: true } });

    if (!screen) {
      throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
    }

    const events = await prisma.screenEvent.findMany({
      where: { screenId },
      include: { media: true },
      orderBy: { createdAt: "desc" },
      take: 80
    });

    return events.map(serializeScreenEvent);
  },

  async recordEvent(screenId: string, deviceKey: string | null, input: unknown) {
    const data = screenEventSchema.parse(input);
    await assertDeviceAccess(screenId, deviceKey);

    if (data.mediaId) {
      const media = await prisma.media.findUnique({ where: { id: data.mediaId } });

      if (!media) {
        throw new ApiError(404, "media_not_found", "Mídia não encontrada.");
      }
    }

    const event = await prisma.screenEvent.create({
      data: {
        screenId,
        level: data.level,
        type: data.type,
        message: data.message,
        mediaId: data.mediaId ?? null,
        metadata: toJson(data.metadata)
      },
      include: { media: true }
    });

    return serializeScreenEvent(event);
  },

  async createCommand(screenId: string, requestedById: string, input: unknown) {
    const data = screenCommandCreateSchema.parse(input);
    const screen = await prisma.screen.findUnique({ where: { id: screenId }, select: { id: true } });

    if (!screen) {
      throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
    }

    const command = await prisma.screenCommand.create({
      data: {
        screenId,
        requestedById,
        type: data.type,
        payload: toJson(data.payload)
      }
    });

    return serializeScreenCommand(command);
  },

  async pollCommands(screenId: string, deviceKey: string | null) {
    await assertDeviceAccess(screenId, deviceKey);

    const commands = await prisma.$transaction(async (tx) => {
      const pendingCommands = await tx.screenCommand.findMany({
        where: { screenId, status: "pending" },
        orderBy: { requestedAt: "asc" },
        take: 10
      });

      if (pendingCommands.length > 0) {
        await tx.screenCommand.updateMany({
          where: { id: { in: pendingCommands.map((command) => command.id) } },
          data: {
            status: "delivered",
            deliveredAt: new Date()
          }
        });
      }

      return tx.screenCommand.findMany({
        where: { id: { in: pendingCommands.map((command) => command.id) } },
        orderBy: { requestedAt: "asc" }
      });
    });

    return commands.map(serializeScreenCommand);
  },

  async acknowledgeCommand(screenId: string, deviceKey: string | null, input: unknown) {
    const data = screenCommandAckSchema.parse(input);
    await assertDeviceAccess(screenId, deviceKey);

    const command = await prisma.screenCommand.findFirst({
      where: {
        id: data.commandId,
        screenId
      }
    });

    if (!command) {
      throw new ApiError(404, "screen_command_not_found", "Comando da tela não encontrado.");
    }

    const updatedCommand = await prisma.screenCommand.update({
      where: { id: command.id },
      data: {
        status: data.status,
        acknowledgedAt: new Date(),
        errorMessage: data.errorMessage ?? null
      }
    });

    return serializeScreenCommand(updatedCommand);
  },

  async createMirrorSession(screenId: string, requestedById: string) {
    const screen = await prisma.screen.findUnique({ where: { id: screenId }, select: { id: true } });

    if (!screen) {
      throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
    }

    const session = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.screenMirrorSession.create({
        data: {
          screenId,
          requestedById,
          status: "requested"
        }
      });

      await tx.screenCommand.create({
        data: {
          screenId,
          requestedById,
          type: "start_screen_mirror",
          payload: toJson({ sessionId: createdSession.id })
        }
      });

      return createdSession;
    });

    return serializeScreenMirrorSession(session);
  },

  async getMirrorSessionForAdmin(screenId: string, sessionId: string) {
    await assertScreenExists(screenId);
    return serializeScreenMirrorSession(await getMirrorSession(screenId, sessionId));
  },

  async getMirrorSessionForDevice(screenId: string, deviceKey: string | null, sessionId: string) {
    await assertDeviceAccess(screenId, deviceKey);
    return serializeScreenMirrorSession(await getMirrorSession(screenId, sessionId));
  },

  async updateMirrorSessionForAdmin(screenId: string, sessionId: string, input: unknown) {
    await assertScreenExists(screenId);
    const data = screenMirrorSessionUpdateSchema.parse(input);
    return serializeScreenMirrorSession(await updateMirrorSession(screenId, sessionId, data));
  },

  async updateMirrorSessionForDevice(screenId: string, deviceKey: string | null, sessionId: string, input: unknown) {
    await assertDeviceAccess(screenId, deviceKey);
    const data = screenMirrorSessionUpdateSchema.parse(input);
    return serializeScreenMirrorSession(await updateMirrorSession(screenId, sessionId, data));
  },

  async stopMirrorSession(screenId: string, requestedById: string, sessionId: string) {
    await assertScreenExists(screenId);

    const session = await prisma.$transaction(async (tx) => {
      const existingSession = await tx.screenMirrorSession.findFirst({
        where: { id: sessionId, screenId },
        select: { id: true }
      });

      if (!existingSession) {
        throw new ApiError(404, "screen_mirror_session_not_found", "Sessão de espelhamento não encontrada.");
      }

      const updatedSession = await tx.screenMirrorSession.update({
        where: { id: existingSession.id },
        data: {
          status: "ended",
          endedAt: new Date()
        }
      });

      await tx.screenCommand.create({
        data: {
          screenId,
          requestedById,
          type: "stop_screen_mirror",
          payload: toJson({ sessionId })
        }
      });

      return updatedSession;
    });

    return serializeScreenMirrorSession(session);
  },

  async listMirrorCandidatesForAdmin(screenId: string, sessionId: string) {
    await assertScreenExists(screenId);
    await getMirrorSession(screenId, sessionId);
    const candidates = await prisma.screenMirrorCandidate.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" }
    });

    return candidates.map(serializeScreenMirrorCandidate);
  },

  async listMirrorCandidatesForDevice(screenId: string, deviceKey: string | null, sessionId: string) {
    await assertDeviceAccess(screenId, deviceKey);
    await getMirrorSession(screenId, sessionId);
    const candidates = await prisma.screenMirrorCandidate.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" }
    });

    return candidates.map(serializeScreenMirrorCandidate);
  },

  async createMirrorCandidateForAdmin(screenId: string, sessionId: string, input: unknown) {
    await assertScreenExists(screenId);
    await getMirrorSession(screenId, sessionId);
    const data = screenMirrorCandidateCreateSchema.parse(input);

    if (data.peer !== "viewer") {
      throw new ApiError(400, "invalid_mirror_peer", "O painel só pode enviar candidatos como viewer.");
    }

    const candidate = await prisma.screenMirrorCandidate.create({
      data: {
        sessionId,
        peer: data.peer,
        candidate: toJson(data.candidate) ?? Prisma.JsonNull
      }
    });

    return serializeScreenMirrorCandidate(candidate);
  },

  async createMirrorCandidateForDevice(screenId: string, deviceKey: string | null, sessionId: string, input: unknown) {
    await assertDeviceAccess(screenId, deviceKey);
    await getMirrorSession(screenId, sessionId);
    const data = screenMirrorCandidateCreateSchema.parse(input);

    if (data.peer !== "screen") {
      throw new ApiError(400, "invalid_mirror_peer", "A TV só pode enviar candidatos como screen.");
    }

    const candidate = await prisma.screenMirrorCandidate.create({
      data: {
        sessionId,
        peer: data.peer,
        candidate: toJson(data.candidate) ?? Prisma.JsonNull
      }
    });

    return serializeScreenMirrorCandidate(candidate);
  },

  async recordHeartbeat(screenId: string, deviceKey: string | null, input: unknown) {
    const data = screenHeartbeatSchema.parse(input);
    await assertDeviceAccess(screenId, deviceKey);

    const receivedAt = new Date();
    const heartbeat = await prisma.$transaction(async (tx) => {
      let currentMediaId: string | null = null;

      if (data.currentMediaId) {
        const media = await tx.media.findUnique({
          where: { id: data.currentMediaId },
          select: { id: true }
        });
        currentMediaId = media?.id ?? null;
      }

      const createdHeartbeat = await tx.screenHeartbeat.create({
        data: {
          screenId,
          status: data.status,
          appVersion: data.appVersion ?? null,
          ipAddress: data.ipAddress ?? null,
          currentMediaId,
          currentPlaylistItemId: data.currentPlaylistItemId ?? null,
          playbackPositionSeconds: data.playbackPositionSeconds ?? null,
          playbackDurationSeconds: data.playbackDurationSeconds ?? null,
          playbackState: data.playbackState ?? null,
          sentAt: receivedAt
        }
      });

      await tx.screen.update({
        where: { id: screenId },
        data: {
          status: data.status,
          lastSeenAt: receivedAt
        }
      });

      return createdHeartbeat;
    });

    return heartbeat;
  }
};

function toJson(value: Record<string, unknown> | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

async function assertScreenExists(screenId: string) {
  const screen = await prisma.screen.findUnique({ where: { id: screenId }, select: { id: true } });

  if (!screen) {
    throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
  }

  return screen;
}

async function getMirrorSession(screenId: string, sessionId: string) {
  const session = await prisma.screenMirrorSession.findFirst({
    where: {
      id: sessionId,
      screenId
    }
  });

  if (!session) {
    throw new ApiError(404, "screen_mirror_session_not_found", "Sessão de espelhamento não encontrada.");
  }

  return session;
}

async function updateMirrorSession(
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

async function assertDeviceAccess(screenId: string, deviceKey: string | null) {
  if (!deviceKey) {
    throw new ApiError(401, "device_key_required", "A chave do dispositivo é obrigatória.");
  }

  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: { id: true, deviceKey: true, orientation: true }
  });

  if (!screen) {
    throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
  }

  if (!screen.deviceKey || screen.deviceKey !== deviceKey) {
    throw new ApiError(403, "invalid_device_key", "A chave do dispositivo é inválida para esta tela.");
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

  throw new ApiError(500, "device_key_generation_failed", "Não foi possível gerar uma chave única para o dispositivo.");
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

  throw new ApiError(500, "activation_code_generation_failed", "Não foi possível gerar um código de ativação único.");
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
