import { getDeviceKeyFromRequest, requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { deviceService } from "@/server/services/deviceService";
import { screenService } from "@/server/services/screenService";

export const runtime = "nodejs";

type Params = { id: string; sessionId: string };

function isDeviceRequest(request: Request) {
  return Boolean(request.headers.get("x-device-key"));
}

export const GET = apiRoute<Params>(async (request, { id, sessionId }) =>
  isDeviceRequest(request)
    ? deviceService.getMirrorSession(id, getDeviceKeyFromRequest(request), sessionId)
    : screenService.getMirrorSessionForAdmin(await requireUser(request), id, sessionId)
);

export const PATCH = apiRoute<Params>(async (request, { id, sessionId }) => {
  const body = await request.json();
  return isDeviceRequest(request)
    ? deviceService.updateMirrorSession(id, getDeviceKeyFromRequest(request), sessionId, body)
    : screenService.updateMirrorSessionForAdmin(await requireUser(request), id, sessionId, body);
});

export const DELETE = apiRoute<Params>(async (request, { id, sessionId }) =>
  screenService.stopMirrorSession(await requireUser(request), id, sessionId)
);
