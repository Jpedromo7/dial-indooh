import { getDeviceKeyFromRequest } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { deviceService } from "@/server/services/deviceService";

export const runtime = "nodejs";

/** Formato antigo usado pelos APKs até 0.1.x. */
export const GET = apiRoute<{ id: string }>(async (request, { id }) =>
  deviceService.getLegacyPlaylist(id, getDeviceKeyFromRequest(request))
);
