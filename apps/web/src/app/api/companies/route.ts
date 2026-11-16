import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { accountService } from "@/server/services/accountService";

export const runtime = "nodejs";

export const GET = apiRoute(async (request) => accountService.listCompanies(await requireUser(request)));
export const POST = apiRoute(async (request) => accountService.createCompany(await requireUser(request), await request.json()), { status: 201 });
