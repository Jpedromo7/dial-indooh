import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CachedManifest, DeviceSession } from "../types/signage";

const SESSION_KEY = "dial_indooh_tv_session";
const MANIFEST_KEY = "dial_indooh_tv_manifest";

export async function getDeviceSession() {
  const rawSession = await AsyncStorage.getItem(SESSION_KEY);
  return rawSession ? (JSON.parse(rawSession) as DeviceSession) : null;
}

export async function saveDeviceSession(session: DeviceSession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearDeviceSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getCachedManifest() {
  const rawManifest = await AsyncStorage.getItem(MANIFEST_KEY);
  return rawManifest ? (JSON.parse(rawManifest) as CachedManifest) : null;
}

export async function saveCachedManifest(manifest: CachedManifest) {
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
}
