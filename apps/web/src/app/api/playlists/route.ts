import { requireAdmin } from "@/server/auth";
import { created, handleRouteError, ok, readJson } from "@/server/http";
import { playlistService } from "@/server/services/playlistService";
import { playlistCreateSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return ok(await playlistService.listPlaylists());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson(request, playlistCreateSchema);
    return created(await playlistService.createPlaylist(body));
  } catch (error) {
    return handleRouteError(error);
  }
}
