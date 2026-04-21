import { requireAdmin } from "@/server/auth";
import { handleRouteError, ok, readJson } from "@/server/http";
import { createMediaUploadUrl } from "@/server/storage/supabaseStorage";
import { mediaUploadUrlSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson(request, mediaUploadUrlSchema);
    return ok(await createMediaUploadUrl(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
