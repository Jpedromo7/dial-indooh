import { requireUser } from "@/server/auth";
import { apiRoute, readJson } from "@/server/http";
import { mediaService } from "@/server/services/mediaService";
import { includeInScreensSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { id }) => mediaService.getMediaScreenIds(await requireUser(request), id));
export const POST = apiRoute<{ id: string }>(async (request, { id }) => {
  const ctx = await requireUser(request);
  const body = await readJson(request, includeInScreensSchema);
  return mediaService.includeInScreens(ctx, id, body.screenIds);
});
