import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, ADMIN_TOKEN_TTL_SECONDS, issueAdminToken, verifyPassword } from "@/server/auth";
import { prisma } from "@/server/db";
import { ApiError, handleRouteError, readJson } from "@/server/http";
import { loginSchema } from "@/server/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request, loginSchema);
    const user = await prisma.user.findUnique({
      where: { email: body.email }
    });

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, "invalid_credentials", "Email or password is invalid.");
    }

    const token = issueAdminToken(user);
    const response = NextResponse.json({
      ok: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_TOKEN_TTL_SECONDS
    });

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
