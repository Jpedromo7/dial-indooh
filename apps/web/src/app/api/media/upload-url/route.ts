import { requireUser } from "@/server/auth";
import { apiRoute, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { createMediaUploadUrl } from "@/server/storage/mediaStorage";
import { mediaUploadUrlSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export const POST = apiRoute(async (request) => {
  const ctx = await requireUser(request);
  await enforceRateLimit(`upload:${ctx.user.id}`, 120, 60 * 60);
  const body = await readJson(request, mediaUploadUrlSchema);
  return createMediaUploadUrl(body);
});
