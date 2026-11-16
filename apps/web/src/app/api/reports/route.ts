import { requireUser } from "@/server/auth";
import { apiRoute, getSearchParams } from "@/server/http";
import { reportService } from "@/server/services/reportService";

export const runtime = "nodejs";

export const GET = apiRoute(async (request) =>
  reportService.buildReport(await requireUser(request), Object.fromEntries(getSearchParams(request)))
);
