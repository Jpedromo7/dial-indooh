import { requireUser } from "@/server/auth";
import { apiRoute, getSearchParams } from "@/server/http";
import { mediaService } from "@/server/services/mediaService";

export const runtime = "nodejs";

export const GET = apiRoute(async (request) => {
  const params = getSearchParams(request);
  return mediaService.listMedia(await requireUser(request), {
    type: params.get("type"),
    companyId: params.get("companyId"),
    q: params.get("q"),
    library: params.get("library") === "1"
  });
});

export const POST = apiRoute(async (request) => mediaService.createMedia(await requireUser(request), await request.json()), { status: 201 });
