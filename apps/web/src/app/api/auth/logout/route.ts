import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE_NAME, ADMIN_COOKIE_NAME } from "@/server/auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true, data: { loggedOut: true } });
  response.cookies.set(ADMIN_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  response.cookies.set(ACCOUNT_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
