import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { DialUpdater, type UpdaterInfo } from "../../modules/dial-updater/src";
import { pauseWatchdog } from "./maintenance";
import { reportScreenEvent } from "./screenEvents";
import type { DeviceSession } from "../types/signage";

/** APK publicado no painel (Configurações > Aplicativo da TV). */
export interface AppRelease {
  versionCode: number;
  url: string;
}

interface UpdateAttempt {
  versionCode: number;
  attempts: number;
  lastAt: number;
}

const ATTEMPT_KEY = "dial.appUpdate.attempt";
const APK_PATH = `${FileSystem.cacheDirectory ?? ""}dial-update.apk`;
/** Tentativas automáticas por versão antes de desistir (o comando do painel sempre tenta). */
const MAX_AUTO_ATTEMPTS = 3;
const MIN_FREE_BYTES = 150 * 1024 * 1024;

let info: UpdaterInfo | null = null;
let latestRelease: AppRelease | null = null;
let installing = false;

/** Informações do instalador nativo (versão atual e como ele instala). Null em builds sem o módulo. */
export async function getUpdaterInfo() {
  if (!DialUpdater) return null;
  if (!info) {
    info = await DialUpdater.getInfo().catch(() => null);
  }
  return info;
}

/** Guardado a cada heartbeat; aplicado na janela de manutenção da madrugada. */
export function setLatestRelease(release: AppRelease | null | undefined) {
  latestRelease = release && typeof release.versionCode === "number" && typeof release.url === "string" ? release : null;
}

export async function hasPendingAppUpdate() {
  const current = await getUpdaterInfo();
  return Boolean(current && latestRelease && latestRelease.versionCode > current.versionCode);
}

/**
 * Baixa o APK e instala. Em caso de sucesso o Android fecha o app e o abre já atualizado.
 * `force` = pedido manual do painel (ignora o limite de tentativas automáticas).
 */
export async function installAppUpdate(session: DeviceSession, release: AppRelease | null = latestRelease, force = false) {
  if (!DialUpdater) {
    throw new Error("Esta versão do app não suporta atualização remota. Instale a 2.2 manualmente uma vez.");
  }
  if (!release) {
    throw new Error("Nenhuma versão publicada no painel.");
  }

  const current = await getUpdaterInfo();
  if (current && release.versionCode <= current.versionCode) {
    return "up_to_date" as const;
  }
  if (installing) {
    return "busy" as const;
  }

  const attempt = await readAttempt();
  const attempts = attempt?.versionCode === release.versionCode ? attempt.attempts : 0;
  if (!force && attempts >= MAX_AUTO_ATTEMPTS) {
    return "gave_up" as const;
  }

  installing = true;
  try {
    await writeAttempt({ versionCode: release.versionCode, attempts: attempts + 1, lastAt: Date.now() });

    const free = await FileSystem.getFreeDiskStorageAsync().catch(() => null);
    if (free !== null && free < MIN_FREE_BYTES) {
      throw new Error("Pouco espaço livre na TV para baixar a atualização.");
    }

    await reportScreenEvent(session, {
      level: "info",
      type: "app_update_started",
      message: `Baixando atualização do app (versão ${release.versionCode}).`
    });

    await FileSystem.deleteAsync(APK_PATH, { idempotent: true }).catch(() => undefined);
    const download = await FileSystem.downloadAsync(release.url, APK_PATH);
    if (download.status < 200 || download.status >= 300) {
      throw new Error(`Falha ao baixar o APK (HTTP ${download.status}).`);
    }

    // A tela "Instalar?" (Android antigo) não pode ser escondida pelo vigia.
    await pauseWatchdog(10);
    const method = await DialUpdater.installApk(APK_PATH);

    await reportScreenEvent(session, {
      level: "info",
      type: "app_update_installing",
      message:
        method === "prompt"
          ? "Atualização baixada. A TV está pedindo confirmação: aperte Instalar no controle."
          : "Atualização baixada, instalando. O app reabre sozinho em instantes."
    });
    return "installing" as const;
  } catch (error) {
    await reportScreenEvent(session, {
      level: "error",
      type: "app_update_failed",
      message: error instanceof Error ? error.message : "Falha ao atualizar o app."
    });
    throw error;
  } finally {
    installing = false;
  }
}

/** Na abertura do app: confirma no painel se a última atualização entrou (ou por que falhou). */
export async function reportPreviousUpdate(session: DeviceSession) {
  const attempt = await readAttempt();
  if (!attempt) return;

  const current = await getUpdaterInfo();
  if (current && current.versionCode >= attempt.versionCode) {
    await AsyncStorage.removeItem(ATTEMPT_KEY).catch(() => undefined);
    await FileSystem.deleteAsync(APK_PATH, { idempotent: true }).catch(() => undefined);
    await reportScreenEvent(session, {
      level: "info",
      type: "app_updated",
      message: `App atualizado para a versão ${current.versionCode}.`
    });
    return;
  }

  const last = DialUpdater?.getLastResult();
  if (last && last.status !== "success" && last.status !== "pending_user_action") {
    await reportScreenEvent(session, {
      level: "warn",
      type: "app_update_failed",
      message: `Instalação não concluída (${last.status})${last.message ? `: ${last.message}` : ""}.`
    });
  }
}

/** Abre "Instalar apps desconhecidos" para este app (passo único na instalação da 2.2). */
export function openInstallPermissionSettings() {
  DialUpdater?.openInstallPermissionSettings();
}

async function readAttempt(): Promise<UpdateAttempt | null> {
  const raw = await AsyncStorage.getItem(ATTEMPT_KEY).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UpdateAttempt;
  } catch {
    return null;
  }
}

async function writeAttempt(attempt: UpdateAttempt) {
  await AsyncStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt)).catch(() => undefined);
}
