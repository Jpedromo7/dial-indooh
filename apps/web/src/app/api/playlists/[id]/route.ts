import { requireAdmin } from "@/server/auth";
import { handleRouteError, ok, readJson, validateParams } from "@/server/http";
import { playlistService } from "@/server/services/playlistService";
import { idParamsSchema, playlistUpdateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);
    const params = validateParams(await context.params, idParamsSchema);
    return ok(await playlistService.getPlaylist(params.id));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);
    const params = validateParams(await context.params, idParamsSchema);
    const body = await readJson(request, playlistUpdateSchema);
    return ok(await playlistService.updatePlaylist(params.id, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
