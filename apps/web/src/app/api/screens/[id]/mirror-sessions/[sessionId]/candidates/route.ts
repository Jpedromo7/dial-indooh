import { getDeviceKeyFromRequest, requireAdmin } from "@/server/auth";
import { handleRouteError, ok, readJson, validateParams } from "@/server/http";
import { screenService } from "@/server/services/screenService";
import { screenMirrorCandidateCreateSchema, screenMirrorSessionParamsSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string; sessionId: string }> | { id: string; sessionId: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = validateParams(await context.params, screenMirrorSessionParamsSchema);

    if (isDeviceRequest(request)) {
      return ok(await screenService.listMirrorCandidatesForDevice(params.id, getDeviceKeyFromRequest(request), params.sessionId));
    }

    await requireAdmin(request);
    return ok(await screenService.listMirrorCandidatesForAdmin(params.id, params.sessionId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = validateParams(await context.params, screenMirrorSessionParamsSchema);
    const body = await readJson(request, screenMirrorCandidateCreateSchema);

    if (isDeviceRequest(request)) {
      return ok(
        await screenService.createMirrorCandidateForDevice(params.id, getDeviceKeyFromRequest(request), params.sessionId, body)
      );
    }

    await requireAdmin(request);
    return ok(await screenService.createMirrorCandidateForAdmin(params.id, params.sessionId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

function isDeviceRequest(request: Request) {
  return Boolean(request.headers.get("x-device-key"));
}
