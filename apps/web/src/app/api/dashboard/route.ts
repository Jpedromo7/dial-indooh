import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { reportService } from "@/server/services/reportService";

export const runtime = "nodejs";

export const GET = apiRoute(async (request) => reportService.getDashboard(await requireUser(request)));
