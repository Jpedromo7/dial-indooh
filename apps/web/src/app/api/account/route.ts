import { requireUser } from "@/server/auth";
import { apiRoute } from "@/server/http";
import { accountService } from "@/server/services/accountService";

export const runtime = "nodejs";

export const GET = apiRoute(async (request) => {
  const ctx = await requireUser(request);
  const session = await accountService.getSession(ctx);
  return { ...session.account, footer: await accountService.getFooter(ctx) };
});

export const PATCH = apiRoute(async (request) => accountService.updateCurrentAccount(await requireUser(request), await request.json()));
