import { created, handleRouteError, readJson } from "@/server/http";
import { screenService } from "@/server/services/screenService";
import { screenActivationSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request, screenActivationSchema);
    return created(await screenService.activateScreen(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
