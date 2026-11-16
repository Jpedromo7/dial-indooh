import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { accountService } from "@/server/services/accountService";

export const runtime = "nodejs";

export const GET = apiRoute(async (request) => accountService.getSession(await requireUser(request)));
