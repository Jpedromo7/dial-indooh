import { z } from "zod";
import { requireUser } from "@/server/auth";
import { ApiError, apiRoute, readJson } from "@/server/http";
import { getInstagramProfile } from "@/server/services/externalData";

export const runtime = "nodejs";

const verifySchema = z.object({ accessToken: z.string().trim().min(20).max(1000) });

/** Valida um token do Instagram e devolve o @ da conta. */
export const POST = apiRoute(async (request) => {
  await requireUser(request);
  const body = await readJson(request, verifySchema);

  try {
    const profile = await getInstagramProfile(body.accessToken);
    return { username: profile.username, id: profile.id };
  } catch {
    throw new ApiError(422, "invalid_instagram_token", "Token inválido ou expirado. Gere um novo token no Instagram.");
  }
});
