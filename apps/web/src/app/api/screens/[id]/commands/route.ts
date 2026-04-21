import { getDeviceKeyFromRequest, requireAdmin } from "@/server/auth";
import { handleRouteError, ok, readJson, validateParams } from "@/server/http";
import { screenService } from "@/server/services/screenService";
import { idParamsSchema, screenCommandCreateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = validateParams(await context.params, idParamsSchema);
    return ok(await screenService.pollCommands(params.id, getDeviceKeyFromRequest(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAdmin(request);
    const params = validateParams(await context.params, idParamsSchema);
    const body = await readJson(request, screenCommandCreateSchema);
    return ok(await screenService.createCommand(params.id, user.id, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
