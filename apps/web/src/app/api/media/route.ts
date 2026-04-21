import { requireAdmin } from "@/server/auth";
import { created, handleRouteError, ok, readJson } from "@/server/http";
import { mediaService } from "@/server/services/mediaService";
import { mediaCreateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return ok(await mediaService.listMedia());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson(request, mediaCreateSchema);
    return created(await mediaService.createMedia(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
