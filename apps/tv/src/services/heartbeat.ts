import * as Network from "expo-network";
import { APP_VERSION } from "../config/appConfig";
import { sendHeartbeat } from "./apiClient";
import type { DeviceSession, TvPlaylistItem } from "../types/signage";

export async function postHeartbeat(session: DeviceSession, currentItem: TvPlaylistItem | null) {
  const networkState = await Network.getNetworkStateAsync().catch(() => null);
  const ipAddress = await Network.getIpAddressAsync().catch(() => undefined);

  if (networkState && networkState.isInternetReachable === false) {
    return;
  }

  await sendHeartbeat(session.screenId, session.deviceKey, {
    status: "online",
    appVersion: APP_VERSION,
    ipAddress,
    currentMediaId: currentItem?.mediaId,
    sentAt: new Date().toISOString()
  });
}
