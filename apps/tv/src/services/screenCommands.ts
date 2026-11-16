import * as Updates from "expo-updates";
import { acknowledgeScreenCommand, fetchScreenCommands } from "./apiClient";
import { clearAllMedia } from "./manifestSync";
import { openOverlayPermissionSettings } from "./systemSettings";
import type { RemoteControlKey } from "@dialindooh/shared";
import type { DeviceSession, ScreenCommand } from "../types/signage";

interface CommandHandlers {
  refreshPlaylist: () => Promise<void>;
  restartPlayer: () => void;
  remoteKey: (key: RemoteControlKey, commandId: string) => void;
  startScreenMirror: (sessionId: string) => Promise<void>;
  stopScreenMirror: (sessionId: string) => Promise<void>;
}

export async function pollAndRunScreenCommands(session: DeviceSession, handlers: CommandHandlers) {
  const commands = await fetchScreenCommands(session.screenId, session.deviceKey);

  for (const command of commands) {
    await runCommand(session, command, handlers);
  }
}

async function runCommand(session: DeviceSession, command: ScreenCommand, handlers: CommandHandlers) {
  try {
    let shouldReloadApp = false;

    if (command.type === "refresh_playlist") {
      await handlers.refreshPlaylist();
    }

    if (command.type === "clear_cache") {
      await clearAllMedia();
      await handlers.refreshPlaylist();
    }

    if (command.type === "restart_player") {
      handlers.restartPlayer();
    }

    if (command.type === "reload_app") {
      handlers.restartPlayer();
      shouldReloadApp = true;
    }

    if (command.type === "open_overlay_settings") {
      await openOverlayPermissionSettings();
    }

    if (command.type === "remote_key") {
      const key = getRemoteControlKey(command.payload);
      handlers.remoteKey(key, command.id);
    }

    if (command.type === "start_screen_mirror") {
      await handlers.startScreenMirror(getMirrorSessionId(command.payload));
    }

    if (command.type === "stop_screen_mirror") {
      await handlers.stopScreenMirror(getMirrorSessionId(command.payload));
    }

    await acknowledgeScreenCommand(session.screenId, session.deviceKey, {
      commandId: command.id,
      status: "acknowledged"
    });

    if (shouldReloadApp) {
      await reloadAppWithLatestUpdate();
    }
  } catch (error) {
    await acknowledgeScreenCommand(session.screenId, session.deviceKey, {
      commandId: command.id,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Falha ao executar o comando."
    }).catch(() => undefined);
  }
}

function getMirrorSessionId(payload: Record<string, unknown> | null) {
  const sessionId = payload?.sessionId;

  if (typeof sessionId === "string" && sessionId.length > 0) {
    return sessionId;
  }

  throw new Error("Sessão de espelhamento inválida.");
}

function getRemoteControlKey(payload: Record<string, unknown> | null): RemoteControlKey {
  const key = payload?.key;

  if (key === "up" || key === "down" || key === "left" || key === "right" || key === "select" || key === "back") {
    return key;
  }

  throw new Error("Tecla remota inválida.");
}

async function reloadAppWithLatestUpdate() {
  const update = await Updates.checkForUpdateAsync().catch(() => null);

  if (update?.isAvailable) {
    await Updates.fetchUpdateAsync();
  }

  await Updates.reloadAsync();
}
