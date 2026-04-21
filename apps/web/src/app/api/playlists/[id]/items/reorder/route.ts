import { requireAdmin } from "@/server/auth";
import { handleRouteError, ok, readJson, validateParams } from "@/server/http";
import { playlistService } from "@/server/services/playlistService";
import { idParamsSchema, playlistItemsReorderSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);
    const params = validateParams(await context.params, idParamsSchema);
    const body = await readJson(request, playlistItemsReorderSchema);
    return ok(await playlistService.reorderItems(params.id, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
