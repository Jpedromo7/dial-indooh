import { requireOptionalNativeModule } from "expo";

export type UpdateMethod = "device_owner" | "root" | "session" | "prompt";

export interface UpdaterInfo {
  versionCode: number;
  sdkInt: number;
  isDeviceOwner: boolean;
  hasRoot: boolean;
  canRequestInstalls: boolean;
  method: UpdateMethod;
}

export interface InstallResult {
  status: "success" | "pending_user_action" | "aborted" | "blocked" | "conflict" | "incompatible" | "invalid" | "storage" | "failure";
  message: string | null;
  at: number;
}

interface DialUpdaterNative {
  getInfo(): Promise<UpdaterInfo>;
  installApk(path: string): Promise<UpdateMethod>;
  getLastResult(): InstallResult | null;
  openInstallPermissionSettings(): void;
}

/** null em builds antigos (2.1 ou anterior) que não têm o módulo nativo. */
export const DialUpdater = requireOptionalNativeModule<DialUpdaterNative>("DialUpdater");
