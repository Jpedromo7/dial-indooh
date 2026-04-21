import { requireAdmin } from "@/server/auth";
import { created, handleRouteError, readJson, validateParams } from "@/server/http";
import { playlistService } from "@/server/services/playlistService";
import { idParamsSchema, playlistItemCreateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireAdmin(request);
    const params = validateParams(await context.params, idParamsSchema);
    const body = await readJson(request, playlistItemCreateSchema);
    return created(await playlistService.addItem(params.id, body));
  } catch (error) {
    return handleRouteError(error);
  }
}
