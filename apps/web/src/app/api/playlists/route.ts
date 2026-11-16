import { requireUser } from "@/server/auth";
import { apiRoute, getSearchParams } from "@/server/http";
import { playlistService } from "@/server/services/playlistService";

export const runtime = "nodejs";

export const GET = apiRoute(async (request) =>
  playlistService.listPlaylists(await requireUser(request), { library: getSearchParams(request).get("library") === "1" })
);
export const POST = apiRoute(async (request) => playlistService.createPlaylist(await requireUser(request), await request.json()), {
  status: 201
});
