import { requireUser } from "@/server/auth";
import { apiRoute, readJson } from "@/server/http";
import { playlistService } from "@/server/services/playlistService";
import { includeInScreensSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { id }) =>
  playlistService.getPlaylistScreenIds(await requireUser(request), id)
);
export const POST = apiRoute<{ id: string }>(async (request, { id }) => {
  const ctx = await requireUser(request);
  const body = await readJson(request, includeInScreensSchema);
  return playlistService.includeInScreens(ctx, id, body.screenIds);
});
