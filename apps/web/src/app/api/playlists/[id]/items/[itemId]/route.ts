import { requireAdmin } from "@/server/auth";
import { handleRouteError, ok, readJson, validateParams } from "@/server/http";
import { playlistService } from "@/server/services/playlistService";
import { playlistItemParamsSchema, playlistItemUpdateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string; itemId: string }> | { id: string; itemId: string };
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);
    const params = validateParams(await context.params, playlistItemParamsSchema);
    return ok(await playlistService.deleteItem(params.id, params.itemId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);
    const params = validateParams(await context.params, playlistItemParamsSchema);
    const body = await readJson(request, playlistItemUpdateSchema);
    return ok(await playlistService.updateItem(params.id, params.itemId, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
