import { getDeviceKeyFromRequest, requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { deviceService } from "@/server/services/deviceService";
import { screenService } from "@/server/services/screenService";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { id }) => screenService.listEvents(await requireUser(request), id));
export const POST = apiRoute<{ id: string }>(async (request, { id }) =>
  deviceService.recordEvent(id, getDeviceKeyFromRequest(request), await request.json())
);
