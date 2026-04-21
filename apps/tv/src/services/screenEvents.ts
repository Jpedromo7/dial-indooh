import { sendScreenEvent } from "./apiClient";
import type { DeviceSession, ScreenEventInput } from "../types/signage";

export function reportScreenEvent(session: DeviceSession, input: ScreenEventInput) {
  return sendScreenEvent(session.screenId, session.deviceKey, input).catch(() => undefined);
}
