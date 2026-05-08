import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";

export const ADMIN_COOKIE_NAME = "dial_indooh_admin";
export const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 8;

interface AdminTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function issueAdminToken(user: { id: string; email: string; role: UserRole }) {
  const payload: AdminTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ADMIN_TOKEN_TTL_SECONDS
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function requireAdmin(request: Request) {
  const token = getBearerToken(request) ?? getCookieToken(request);

  if (!token) {
    throw new ApiError(401, "unauthorized", "Autenticação de administrador obrigatória.");
  }

  const payload = verifyAdminToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true }
  });

  if (!user || user.role !== "admin") {
    throw new ApiError(403, "forbidden", "Acesso de administrador obrigatório.");
  }

  return user;
}

export function getDeviceKeyFromRequest(request: Request) {
  const headerKey = request.headers.get("x-device-key")?.trim();
  const bearerKey = getBearerToken(request);
  return headerKey || bearerKey || null;
}

function verifyAdminToken(token: string): AdminTokenPayload {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    throw new ApiError(401, "invalid_token", "O token de administrador é inválido.");
  }

  let payload: AdminTokenPayload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminTokenPayload;
  } catch {
    throw new ApiError(401, "invalid_token", "O conteúdo do token de administrador é inválido.");
  }

  if (!payload.sub || payload.role !== "admin" || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, "invalid_token", "O token de administrador expirou ou é inválido.");
  }

  return payload;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

function getCookieToken(request: Request) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${ADMIN_COOKIE_NAME}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 24) {
    throw new ApiError(500, "auth_secret_missing", "AUTH_SECRET precisa estar configurado com pelo menos 24 caracteres.");
  }

  return secret;
}

function sign(value: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
