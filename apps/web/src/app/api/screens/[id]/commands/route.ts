import { getDeviceKeyFromRequest, requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { deviceService } from "@/server/services/deviceService";
import { screenService } from "@/server/services/screenService";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { id }) => deviceService.pollCommands(id, getDeviceKeyFromRequest(request)));
export const POST = apiRoute<{ id: string }>(async (request, { id }) =>
  screenService.createCommand(await requireUser(request), id, await request.json())
);
