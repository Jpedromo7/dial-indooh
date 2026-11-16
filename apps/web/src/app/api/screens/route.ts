import { requireUser } from "@/server/auth";
import { apiRoute, getSearchParams } from "@/server/http";
import { screenService } from "@/server/services/screenService";

export const runtime = "nodejs";

export const GET = apiRoute(async (request) => {
  const params = getSearchParams(request);
  return screenService.listScreens(await requireUser(request), {
    status: params.get("status"),
    q: params.get("q"),
    favorites: params.get("favorites") === "1"
  });
});

export const POST = apiRoute(async (request) => screenService.createScreen(await requireUser(request), await request.json()), { status: 201 });
