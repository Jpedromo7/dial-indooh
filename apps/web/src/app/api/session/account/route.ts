import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE_NAME, ADMIN_TOKEN_TTL_SECONDS, requireUser } from "@/server/auth";
import { ApiError, apiRoute, readJson } from "@/server/http";
import { accountSwitchSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

/** Alterna a conta ativa (revendas e administrador da plataforma). */
export const POST = apiRoute(async (request) => {
  const ctx = await requireUser(request);
  const body = await readJson(request, accountSwitchSchema);

  if (body.accountId && !ctx.manageableAccountIds.includes(body.accountId)) {
    throw new ApiError(403, "forbidden", "Você não tem acesso a esta conta.");
  }

  const response = NextResponse.json({ ok: true, data: { accountId: body.accountId ?? ctx.user.accountId } });
  response.cookies.set(ACCOUNT_COOKIE_NAME, body.accountId ?? "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: body.accountId ? ADMIN_TOKEN_TTL_SECONDS : 0
  });
  return response;
});
