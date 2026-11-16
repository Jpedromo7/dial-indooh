import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { screenService } from "@/server/services/screenService";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { id }) => screenService.getScreen(await requireUser(request), id));
export const PATCH = apiRoute<{ id: string }>(async (request, { id }) =>
  screenService.updateScreen(await requireUser(request), id, await request.json())
);
export const DELETE = apiRoute<{ id: string }>(async (request, { id }) => screenService.deleteScreen(await requireUser(request), id));
