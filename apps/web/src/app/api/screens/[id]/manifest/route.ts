import { getDeviceKeyFromRequest } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { deviceService } from "@/server/services/deviceService";

export const runtime = "nodejs";

export const GET = apiRoute<{ id: string }>(async (request, { id }) => deviceService.getManifest(id, getDeviceKeyFromRequest(request)));
