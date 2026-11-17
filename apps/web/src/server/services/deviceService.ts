import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { hashDeviceKey, safeEqual } from "@/server/auth";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { buildDeviceManifest, toLegacyPlaylist } from "@/server/services/manifestService";
import { getMirrorSession, toJson, updateMirrorSession } from "@/server/services/screenService";
import {
  serializeScreenCommand,
  serializeScreenEvent,
  serializeScreenMirrorCandidate,
  serializeScreenMirrorSession
} from "@/server/utils/serializers";
import {
  playLogBatchSchema,
  screenActivationSchema,
  screenCommandAckSchema,
  screenEventSchema,
  screenHeartbeatSchema,
  screenMirrorCandidateCreateSchema,
  screenMirrorSessionUpdateSchema
} from "@/server/validation/schemas";

/** Intervalo mínimo entre heartbeats gravados no histórico (o estado ao vivo é atualizado sempre). */
const HEARTBEAT_HISTORY_INTERVAL_MS = 5 * 60 * 1000;
/** Comandos entregues e não confirmados voltam para a fila depois deste tempo. */
const COMMAND_REDELIVERY_MS = 2 * 60 * 1000;

/** Endpoints usados pelo app da TV. Autenticação por chave do dispositivo (guardada só como hash). */
export const deviceService = {
  async activate(input: unknown) {
    const data = screenActivationSchema.parse(input);
    const screen = await prisma.screen.findUnique({ where: { activationCode: data.activationCode } });

    if (!screen) {
      throw new ApiError(404, "activation_code_not_found", "Código de ativação não encontrado.");
    }

    const deviceKey = crypto.randomBytes(32).toString("base64url");

    // O código é consumido: para trocar o aparelho, o painel gera um código novo ("Reparear").
    await prisma.screen.update({
      where: { id: screen.id },
      data: { deviceKeyHash: hashDeviceKey(deviceKey), deviceKey: null, activationCode: null }
    });

    return { screenId: screen.id, deviceKey };
  },

  async getManifest(screenId: string, deviceKey: string | null) {
    await assertDeviceAccess(screenId, deviceKey);
    return buildDeviceManifest(screenId);
  },

  async getLegacyPlaylist(screenId: string, deviceKey: string | null) {
    await assertDeviceAccess(screenId, deviceKey);
    return toLegacyPlaylist(await buildDeviceManifest(screenId));
  },

  async recordHeartbeat(screenId: string, deviceKey: string | null, input: unknown, publicIp?: string | null) {
    const data = screenHeartbeatSchema.parse(input);
    const screen = await assertDeviceAccess(screenId, deviceKey);
    const receivedAt = new Date();
    const { diagnostics, ...live } = data;
    const shouldStoreHistory =
      !screen.lastHeartbeatStoredAt || receivedAt.getTime() - screen.lastHeartbeatStoredAt.getTime() >= HEARTBEAT_HISTORY_INTERVAL_MS;

    const mergedDiagnostics = {
      ...((screen.diagnostics ?? {}) as Record<string, unknown>),
      ...(diagnostics ?? {}),
      appVersion: data.appVersion ?? null
    };

    await prisma.screen.update({
      where: { id: screenId },
      data: {
        status: data.status,
        lastSeenAt: receivedAt,
        lastHeartbeat: { ...live, publicIp: publicIp ?? null, sentAt: receivedAt.toISOString() } as Prisma.InputJsonValue,
        diagnostics: mergedDiagnostics as Prisma.InputJsonValue,
        lastHeartbeatStoredAt: shouldStoreHistory ? receivedAt : undefined
      }
    });

    if (shouldStoreHistory) {
      const currentMedia = data.currentMediaId
        ? await prisma.media.findUnique({ where: { id: data.currentMediaId }, select: { id: true } })
        : null;

      await prisma.screenHeartbeat.create({
        data: {
          screenId,
          status: data.status,
          appVersion: data.appVersion ?? null,
          ipAddress: data.ipAddress ?? null,
          currentMediaId: currentMedia?.id ?? null,
          currentPlaylistItemId: data.currentPlaylistItemId ?? null,
          playbackPositionSeconds: data.playbackPositionSeconds ?? null,
          playbackDurationSeconds: data.playbackDurationSeconds ?? null,
          playbackState: data.playbackState ?? null,
          sentAt: receivedAt
        }
      });
    }

    return { receivedAt: receivedAt.toISOString() };
  },

  async recordEvent(screenId: string, deviceKey: string | null, input: unknown) {
    const data = screenEventSchema.parse(input);
    await assertDeviceAccess(screenId, deviceKey);

    const media = data.mediaId ? await prisma.media.findUnique({ where: { id: data.mediaId }, select: { id: true } }) : null;
    const event = await prisma.screenEvent.create({
      data: {
        screenId,
        level: data.level,
        type: data.type,
        message: data.message,
        mediaId: media?.id ?? null,
        metadata: toJson(data.metadata)
      },
      include: { media: true }
    });

    return serializeScreenEvent(event);
  },

  async recordPlays(screenId: string, deviceKey: string | null, input: unknown) {
    const data = playLogBatchSchema.parse(input);
    await assertDeviceAccess(screenId, deviceKey);

    const mediaIds = [...new Set(data.plays.map((play) => play.mediaId))];
    const playlistIds = [...new Set(data.plays.map((play) => play.playlistId).filter((id): id is string => Boolean(id)))];
    const [media, playlists] = await Promise.all([
      prisma.media.findMany({ where: { id: { in: mediaIds } }, select: { id: true, recordStats: true } }),
      playlistIds.length ? prisma.playlist.findMany({ where: { id: { in: playlistIds } }, select: { id: true } }) : []
    ]);
    const tracked = new Set(media.filter((item) => item.recordStats).map((item) => item.id));
    const existingPlaylists = new Set(playlists.map((playlist) => playlist.id));
    const now = Date.now();

    const rows = data.plays
      .filter((play) => tracked.has(play.mediaId))
      .filter((play) => {
        const started = new Date(play.startedAt).getTime();
        // Descarta horários absurdos (relógio da TV muito errado).
        return started > now - 400 * 24 * 60 * 60 * 1000 && started < now + 24 * 60 * 60 * 1000;
      })
      .map((play) => ({
        id: `${screenId}:${play.id}`.slice(0, 120),
        screenId,
        mediaId: play.mediaId,
        playlistId: play.playlistId && existingPlaylists.has(play.playlistId) ? play.playlistId : null,
        startedAt: new Date(play.startedAt),
        durationSeconds: play.durationSeconds
      }));

    if (rows.length) {
      await prisma.playLog.createMany({ data: rows, skipDuplicates: true });
    }

    return { accepted: rows.length };
  },

  async pollCommands(screenId: string, deviceKey: string | null) {
    await assertDeviceAccess(screenId, deviceKey);
    const redeliverBefore = new Date(Date.now() - COMMAND_REDELIVERY_MS);

    const commands = await prisma.$transaction(async (tx) => {
      const pendingCommands = await tx.screenCommand.findMany({
        where: {
          screenId,
          OR: [{ status: "pending" }, { status: "delivered", deliveredAt: { lt: redeliverBefore } }],
          requestedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        orderBy: { requestedAt: "asc" },
        take: 10
      });

      if (pendingCommands.length > 0) {
        await tx.screenCommand.updateMany({
          where: { id: { in: pendingCommands.map((command) => command.id) } },
          data: { status: "delivered", deliveredAt: new Date() }
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

    const command = await prisma.screenCommand.findFirst({ where: { id: data.commandId, screenId } });

    if (!command) {
      throw new ApiError(404, "screen_command_not_found", "Comando da tela não encontrado.");
    }

    const updatedCommand = await prisma.screenCommand.update({
      where: { id: command.id },
      data: { status: data.status, acknowledgedAt: new Date(), errorMessage: data.errorMessage ?? null }
    });

    return serializeScreenCommand(updatedCommand);
  },

  async getMirrorSession(screenId: string, deviceKey: string | null, sessionId: string) {
    await assertDeviceAccess(screenId, deviceKey);
    return serializeScreenMirrorSession(await getMirrorSession(screenId, sessionId));
  },

  async updateMirrorSession(screenId: string, deviceKey: string | null, sessionId: string, input: unknown) {
    await assertDeviceAccess(screenId, deviceKey);
    const data = screenMirrorSessionUpdateSchema.parse(input);
    return serializeScreenMirrorSession(await updateMirrorSession(screenId, sessionId, data));
  },

  async listMirrorCandidates(screenId: string, deviceKey: string | null, sessionId: string) {
    await assertDeviceAccess(screenId, deviceKey);
    await getMirrorSession(screenId, sessionId);
    const candidates = await prisma.screenMirrorCandidate.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
    return candidates.map(serializeScreenMirrorCandidate);
  },

  async createMirrorCandidate(screenId: string, deviceKey: string | null, sessionId: string, input: unknown) {
    await assertDeviceAccess(screenId, deviceKey);
    await getMirrorSession(screenId, sessionId);
    const data = screenMirrorCandidateCreateSchema.parse(input);

    if (data.peer !== "screen") {
      throw new ApiError(400, "invalid_mirror_peer", "A TV só pode enviar candidatos como screen.");
    }

    const candidate = await prisma.screenMirrorCandidate.create({
      data: { sessionId, peer: data.peer, candidate: toJson(data.candidate) ?? Prisma.JsonNull }
    });

    return serializeScreenMirrorCandidate(candidate);
  }
};

export async function assertDeviceAccess(screenId: string, deviceKey: string | null) {
  if (!deviceKey) {
    throw new ApiError(401, "device_key_required", "A chave do dispositivo é obrigatória.");
  }

  const screen = await prisma.screen.findUnique({ where: { id: screenId } });

  if (!screen) {
    throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
  }

  const keyHash = hashDeviceKey(deviceKey);

  if (screen.deviceKeyHash && safeEqual(screen.deviceKeyHash, keyHash)) {
    return screen;
  }

  // Chaves antigas em texto puro: converte para hash no primeiro acesso.
  if (!screen.deviceKeyHash && screen.deviceKey && safeEqual(screen.deviceKey, deviceKey)) {
    return prisma.screen.update({
      where: { id: screenId },
      data: { deviceKeyHash: keyHash, deviceKey: null, activationCode: null }
    });
  }

  throw new ApiError(403, "invalid_device_key", "A chave do dispositivo é inválida para esta tela.");
}
