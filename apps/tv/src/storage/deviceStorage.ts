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

const MANIFEST_V2_KEY = "dial_indooh_tv_manifest_v2";
const BRANDING_KEY = "dial_indooh_tv_branding";

export async function getCachedManifestV2() {
  const raw = await AsyncStorage.getItem(MANIFEST_V2_KEY);
  return raw ? (JSON.parse(raw) as import("../types/signage").CachedManifestV2) : null;
}

export async function saveCachedManifestV2(value: import("../types/signage").CachedManifestV2) {
  await AsyncStorage.setItem(MANIFEST_V2_KEY, JSON.stringify(value));
  await AsyncStorage.setItem(BRANDING_KEY, JSON.stringify(value.manifest.branding));
}

/** Logo e imagem de abertura da conta (para mostrar já na inicialização). */
export async function getCachedBranding() {
  const raw = await AsyncStorage.getItem(BRANDING_KEY).catch(() => null);
  return raw ? (JSON.parse(raw) as { logoUrl: string | null; splashUrl: string | null }) : null;
}
