import { getDeviceKeyFromRequest } from "@/server/auth";
import { handleRouteError, ok, validateParams } from "@/server/http";
import { screenService } from "@/server/services/screenService";
import { idParamsSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = validateParams(await context.params, idParamsSchema);
    return ok(await screenService.getDevicePlaylist(params.id, getDeviceKeyFromRequest(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}
