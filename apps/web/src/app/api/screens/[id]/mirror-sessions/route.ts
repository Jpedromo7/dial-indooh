import { requireAdmin } from "@/server/auth";
import { handleRouteError, ok, validateParams } from "@/server/http";
import { screenService } from "@/server/services/screenService";
import { idParamsSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAdmin(request);
    const params = validateParams(await context.params, idParamsSchema);
    return ok(await screenService.createMirrorSession(params.id, user.id));
  } catch (error) {
    return handleRouteError(error);
  }
}
