import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendPlayLogs } from "./apiClient";
import type { DeviceSession, PlayLogEntry } from "../types/signage";

const QUEUE_KEY = "dial_indooh_tv_play_queue";
const MAX_QUEUE = 20000;
const BATCH_SIZE = 400;

let memoryQueue: PlayLogEntry[] | null = null;
let flushing = false;

async function loadQueue() {
  if (memoryQueue) return memoryQueue;
  const raw = await AsyncStorage.getItem(QUEUE_KEY).catch(() => null);
  memoryQueue = raw ? (JSON.parse(raw) as PlayLogEntry[]) : [];
  return memoryQueue;
}

async function persist() {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(memoryQueue ?? [])).catch(() => undefined);
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Registra uma exibição (comprovação). Fica na fila do aparelho até ser enviada — funciona offline. */
export async function recordPlay(entry: Omit<PlayLogEntry, "id">) {
  const queue = await loadQueue();
  queue.push({ ...entry, id: randomId() });

  if (queue.length > MAX_QUEUE) {
    queue.splice(0, queue.length - MAX_QUEUE);
  }

  await persist();
}

export async function flushPlays(session: DeviceSession) {
  if (flushing) return;
  flushing = true;

  try {
    const queue = await loadQueue();

    while (queue.length > 0) {
      const batch = queue.slice(0, BATCH_SIZE);
      await sendPlayLogs(session.screenId, session.deviceKey, batch);
      queue.splice(0, batch.length);
      await persist();
    }
  } catch {
    // Sem internet: tenta de novo no próximo ciclo.
  } finally {
    flushing = false;
  }
}
