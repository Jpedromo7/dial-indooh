import * as FileSystem from "expo-file-system/legacy";
import * as Network from "expo-network";
import { Platform } from "react-native";
import { APP_VERSION } from "../config/appConfig";
import { getUpdaterInfo, setLatestRelease } from "./appUpdater";
import { sendHeartbeat } from "./apiClient";
import { getCacheStats } from "./manifestSync";
import type { DeviceSession, PlaybackStatus } from "../types/signage";

let lastDiagnosticsAt = 0;
const DIAGNOSTICS_INTERVAL_MS = 5 * 60 * 1000;

export async function postHeartbeat(session: DeviceSession, playbackStatus: PlaybackStatus) {
  const networkState = await Network.getNetworkStateAsync().catch(() => null);

  if (networkState && networkState.isInternetReachable === false) {
    return;
  }

  const ipAddress = await Network.getIpAddressAsync().catch(() => undefined);
  const includeDiagnostics = Date.now() - lastDiagnosticsAt > DIAGNOSTICS_INTERVAL_MS;
  let diagnostics: Record<string, unknown> | undefined;

  if (includeDiagnostics) {
    const [free, total] = await Promise.all([
      FileSystem.getFreeDiskStorageAsync().catch(() => null),
      FileSystem.getTotalDiskCapacityAsync().catch(() => null)
    ]);
    const constants = (Platform.constants ?? {}) as { Model?: string; Brand?: string; Release?: string };
    const stats = getCacheStats();
    const updater = await getUpdaterInfo();
    diagnostics = {
      appVersionCode: updater?.versionCode ?? null,
      updateMethod: updater?.method ?? null,
      freeDiskBytes: free,
      totalDiskBytes: total,
      cachedItems: stats.cachedItems,
      totalItems: stats.totalItems,
      deviceModel: [constants.Brand, constants.Model].filter(Boolean).join(" ") || null,
      osVersion: constants.Release ? `Android ${constants.Release}` : null
    };
  }

  const response = await sendHeartbeat(session.screenId, session.deviceKey, {
    status: "online",
    appVersion: APP_VERSION,
    ipAddress,
    currentMediaId: playbackStatus.currentItem?.mediaId,
    currentPlaylistItemId: playbackStatus.currentItem?.id ?? null,
    playbackPositionSeconds: playbackStatus.positionSeconds,
    playbackDurationSeconds: playbackStatus.durationSeconds,
    playbackState: playbackStatus.state,
    sentAt: new Date().toISOString(),
    ...(diagnostics ? { diagnostics } : {})
  });

  setLatestRelease(response?.appUpdate);

  if (includeDiagnostics) {
    lastDiagnosticsAt = Date.now();
  }
}
