import { requireUser } from "@/server/auth";
import { apiRoute, readJson } from "@/server/http";
import { accountService } from "@/server/services/accountService";
import { profileUpdateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export const PATCH = apiRoute(async (request) =>
  accountService.updateProfile(await requireUser(request), await readJson(request, profileUpdateSchema))
);
