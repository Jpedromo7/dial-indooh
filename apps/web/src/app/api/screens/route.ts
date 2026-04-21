import { requireAdmin } from "@/server/auth";
import { created, handleRouteError, ok, readJson } from "@/server/http";
import { screenService } from "@/server/services/screenService";
import { screenCreateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return ok(await screenService.listScreens());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson(request, screenCreateSchema);
    return created(await screenService.createScreen(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
