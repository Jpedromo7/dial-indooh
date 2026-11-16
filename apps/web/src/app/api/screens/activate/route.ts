import { apiRoute } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";
import { deviceService } from "@/server/services/deviceService";
import { getRequestIp } from "@/server/utils/request";

export const runtime = "nodejs";

export const POST = apiRoute(
  async (request) => {
    await enforceRateLimit(`activate:${getRequestIp(request) ?? "unknown"}`, 10, 15 * 60);
    return deviceService.activate(await request.json());
  },
  { status: 201 }
);
