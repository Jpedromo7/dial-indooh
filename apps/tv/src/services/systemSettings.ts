import { Linking, Platform } from "react-native";

const ACTION_MANAGE_OVERLAY_PERMISSION = "android.settings.action.MANAGE_OVERLAY_PERMISSION";

export async function openOverlayPermissionSettings() {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    await Linking.sendIntent(ACTION_MANAGE_OVERLAY_PERMISSION);
  } catch {
    await Linking.openSettings();
  }
}
