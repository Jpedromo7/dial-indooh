import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { playlistService } from "@/server/services/playlistService";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { id }) => playlistService.getPlaylist(await requireUser(request), id));
export const PATCH = apiRoute<{ id: string }>(async (request, { id }) =>
  playlistService.updatePlaylist(await requireUser(request), id, await request.json())
);
export const DELETE = apiRoute<{ id: string }>(async (request, { id }) => playlistService.deletePlaylist(await requireUser(request), id));
