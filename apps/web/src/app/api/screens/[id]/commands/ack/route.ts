import { getDeviceKeyFromRequest } from "@/server/auth";
import { handleRouteError, ok, readJson, validateParams } from "@/server/http";
import { screenService } from "@/server/services/screenService";
import { idParamsSchema, screenCommandAckSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = validateParams(await context.params, idParamsSchema);
    const body = await readJson(request, screenCommandAckSchema);
    return ok(await screenService.acknowledgeCommand(params.id, getDeviceKeyFromRequest(request), body));
  } catch (error) {
    return handleRouteError(error);
  }
}
