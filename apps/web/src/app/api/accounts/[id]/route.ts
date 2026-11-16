import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { accountService } from "@/server/services/accountService";

export const runtime = "nodejs";

export const PATCH = apiRoute<{ id: string }>(async (request, { id }) =>
  accountService.updateChildAccount(await requireUser(request), id, await request.json())
);
export const DELETE = apiRoute<{ id: string }>(async (request, { id }) => accountService.deleteChildAccount(await requireUser(request), id));
