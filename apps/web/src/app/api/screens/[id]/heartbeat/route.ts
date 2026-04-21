import { getDeviceKeyFromRequest } from "@/server/auth";
import { handleRouteError, ok, readJson, validateParams } from "@/server/http";
import { screenService } from "@/server/services/screenService";
import { getRequestIp } from "@/server/utils/request";
import { idParamsSchema, screenHeartbeatSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = validateParams(await context.params, idParamsSchema);
    const body = await readJson(request, screenHeartbeatSchema);

    return ok(
      await screenService.recordHeartbeat(params.id, getDeviceKeyFromRequest(request), {
        ...body,
        ipAddress: body.ipAddress ?? getRequestIp(request)
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
