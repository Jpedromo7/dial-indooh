import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE_NAME, ADMIN_COOKIE_NAME, ADMIN_TOKEN_TTL_SECONDS, hashPassword, issueAdminToken, verifyPassword } from "@/server/auth";
import { prisma } from "@/server/db";
import { ApiError, apiRoute, readJson } from "@/server/http";
import { enforceRateLimit, resetRateLimit } from "@/server/rateLimit";
import { getRequestIp } from "@/server/utils/request";
import { loginSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

// Hash usado quando o e-mail não existe, para o tempo de resposta não revelar contas válidas.
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= hashPassword("dial-indooh-dummy-password");
  return dummyHash;
}

export const POST = apiRoute(async (request) => {
  const ip = getRequestIp(request) ?? "unknown";
  await enforceRateLimit(`login:ip:${ip}`, 20, 15 * 60);

  const body = await readJson(request, loginSchema);
  const emailKey = `login:email:${body.email}`;
  await enforceRateLimit(emailKey, 8, 15 * 60);

  const user = await prisma.user.findUnique({ where: { email: body.email }, include: { account: true } });
  const passwordOk = await verifyPassword(body.password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !passwordOk) {
    throw new ApiError(401, "invalid_credentials", "E-mail ou senha inválidos.");
  }

  if (!user.isActive || (user.account && !user.account.isActive && user.role !== "superadmin")) {
    throw new ApiError(403, "user_disabled", "Usuário ou conta desativados. Fale com o administrador.");
  }

  await resetRateLimit(emailKey);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = issueAdminToken(user);
  const response = NextResponse.json({
    ok: true,
    data: { user: { id: user.id, name: user.name, email: user.email, role: user.role } }
  });

  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TOKEN_TTL_SECONDS
  });
  response.cookies.set(ACCOUNT_COOKIE_NAME, "", { path: "/", maxAge: 0 });

  return response;
});
