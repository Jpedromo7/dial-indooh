import * as FileSystem from "expo-file-system/legacy";
import * as Updates from "expo-updates";
import { getZonedNow } from "@dialindooh/shared";

const PAUSE_FILE = `${FileSystem.documentDirectory ?? ""}watchdog_pause_until`;
const APP_STARTED_AT = Date.now();

/** Pausa o vigia nativo (que reabre o app) para permitir mexer nas configurações da TV. */
export async function pauseWatchdog(minutes: number) {
  await FileSystem.writeAsStringAsync(PAUSE_FILE, String(Date.now() + minutes * 60 * 1000)).catch(() => undefined);
}

export async function resumeWatchdog() {
  await FileSystem.deleteAsync(PAUSE_FILE, { idempotent: true }).catch(() => undefined);
}

/**
 * Reinício diário entre 04:00 e 04:10 (fuso do terminal): libera memória das TV boxes
 * e aplica atualizações remotas do app (Expo Updates).
 */
export async function maybeDailyRestart(timezone: string) {
  const now = getZonedNow(timezone);
  const inWindow = now.minutes >= 4 * 60 && now.minutes < 4 * 60 + 10;
  const runningLongEnough = Date.now() - APP_STARTED_AT > 60 * 60 * 1000;

  if (!inWindow || !runningLongEnough) {
    return;
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
    }
  } catch {
    // Sem internet ou em modo de desenvolvimento: só reinicia.
  }

  await Updates.reloadAsync().catch(() => undefined);
}
