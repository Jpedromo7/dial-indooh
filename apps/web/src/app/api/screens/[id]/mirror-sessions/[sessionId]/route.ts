import { getDeviceKeyFromRequest, requireAdmin } from "@/server/auth";
import { handleRouteError, ok, readJson, validateParams } from "@/server/http";
import { screenService } from "@/server/services/screenService";
import { screenMirrorSessionParamsSchema, screenMirrorSessionUpdateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string; sessionId: string }> | { id: string; sessionId: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = validateParams(await context.params, screenMirrorSessionParamsSchema);

    if (isDeviceRequest(request)) {
      return ok(await screenService.getMirrorSessionForDevice(params.id, getDeviceKeyFromRequest(request), params.sessionId));
    }

    await requireAdmin(request);
    return ok(await screenService.getMirrorSessionForAdmin(params.id, params.sessionId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const params = validateParams(await context.params, screenMirrorSessionParamsSchema);
    const body = await readJson(request, screenMirrorSessionUpdateSchema);

    if (isDeviceRequest(request)) {
      return ok(
        await screenService.updateMirrorSessionForDevice(
          params.id,
          getDeviceKeyFromRequest(request),
          params.sessionId,
          body
        )
      );
    }

    await requireAdmin(request);
    return ok(await screenService.updateMirrorSessionForAdmin(params.id, params.sessionId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAdmin(request);
    const params = validateParams(await context.params, screenMirrorSessionParamsSchema);
    return ok(await screenService.stopMirrorSession(params.id, user.id, params.sessionId));
  } catch (error) {
    return handleRouteError(error);
  }
}

function isDeviceRequest(request: Request) {
  return Boolean(request.headers.get("x-device-key"));
}
