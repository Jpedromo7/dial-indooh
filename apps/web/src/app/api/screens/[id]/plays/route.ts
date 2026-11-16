import { getDeviceKeyFromRequest } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { deviceService } from "@/server/services/deviceService";

export const runtime = "nodejs";

export const POST = apiRoute<{ id: string }>(async (request, { id }) =>
  deviceService.recordPlays(id, getDeviceKeyFromRequest(request), await request.json())
);
