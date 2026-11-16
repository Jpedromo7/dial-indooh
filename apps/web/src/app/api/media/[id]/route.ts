import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { mediaService } from "@/server/services/mediaService";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { id }) => mediaService.getMedia(await requireUser(request), id));
export const PATCH = apiRoute<{ id: string }>(async (request, { id }) =>
  mediaService.updateMedia(await requireUser(request), id, await request.json())
);
export const DELETE = apiRoute<{ id: string }>(async (request, { id }) => mediaService.deleteMedia(await requireUser(request), id));
