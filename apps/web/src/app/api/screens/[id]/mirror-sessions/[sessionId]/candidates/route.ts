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
    ? deviceService.listMirrorCandidates(id, getDeviceKeyFromRequest(request), sessionId)
    : screenService.listMirrorCandidatesForAdmin(await requireUser(request), id, sessionId)
);

export const POST = apiRoute<Params>(async (request, { id, sessionId }) => {
  const body = await request.json();
  return isDeviceRequest(request)
    ? deviceService.createMirrorCandidate(id, getDeviceKeyFromRequest(request), sessionId, body)
    : screenService.createMirrorCandidateForAdmin(await requireUser(request), id, sessionId, body);
});
