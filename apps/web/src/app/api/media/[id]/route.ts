import { requireAdmin } from "@/server/auth";
import { handleRouteError, ok, readJson, validateParams } from "@/server/http";
import { mediaService } from "@/server/services/mediaService";
import { mediaIdParamsSchema, mediaUpdateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);
    const params = validateParams(await context.params, mediaIdParamsSchema);
    const body = await readJson(request, mediaUpdateSchema);
    return ok(await mediaService.updateMedia(params.id, body));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);
    const params = validateParams(await context.params, mediaIdParamsSchema);
    return ok(await mediaService.deleteMedia(params.id));
  } catch (error) {
    return handleRouteError(error);
  }
}
