import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { screenService } from "@/server/services/screenService";

export const runtime = "nodejs";

export const POST = apiRoute<{ id: string }>(async (request, { id }) => screenService.duplicateScreen(await requireUser(request), id), {
  status: 201
});
