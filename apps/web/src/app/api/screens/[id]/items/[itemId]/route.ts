import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { screenService } from "@/server/services/screenService";

export const runtime = "nodejs";

export const DELETE = apiRoute<{ id: string; itemId: string }>(async (request, { id, itemId }) =>
  screenService.removeItem(await requireUser(request), id, itemId)
);
