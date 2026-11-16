import { requireUser } from "@/server/auth";
import { apiRoute, readJson } from "@/server/http";
import { mediaService } from "@/server/services/mediaService";
import { bulkDeleteSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(async (request) => {
  const ctx = await requireUser(request);
  const body = await readJson(request, bulkDeleteSchema);
  return mediaService.deleteMany(ctx, body.ids);
});
