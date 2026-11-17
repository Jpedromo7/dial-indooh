import { getDeviceKeyFromRequest } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { deviceService } from "@/server/services/deviceService";
import { getRequestIp } from "@/server/utils/request";

export const runtime = "nodejs";

export const POST = apiRoute<{ id: string }>(async (request, { id }) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const publicIp = getRequestIp(request) ?? null;
  return deviceService.recordHeartbeat(
    id,
    getDeviceKeyFromRequest(request),
    { ...body, ipAddress: body.ipAddress ?? publicIp ?? undefined },
    publicIp
  );
});
