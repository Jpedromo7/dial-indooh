import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { screenService } from "@/server/services/screenService";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { id }) => screenService.listItems(await requireUser(request), id));
export const PUT = apiRoute<{ id: string }>(async (request, { id }) =>
  screenService.replaceItems(await requireUser(request), id, await request.json())
);
export const POST = apiRoute<{ id: string }>(async (request, { id }) =>
  screenService.addItem(await requireUser(request), id, await request.json())
);
