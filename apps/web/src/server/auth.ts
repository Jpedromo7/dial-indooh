import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";

export const ADMIN_COOKIE_NAME = "dial_indooh_admin";
export const ACCOUNT_COOKIE_NAME = "dial_indooh_account";
export const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 8;

interface AdminTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountId: string;
  avatarUrl: string | null;
  timezone: string | null;
  restrictContent: boolean;
}

export interface AuthContext {
  user: AuthUser;
  /** Conta ativa (a do usuário ou uma conta filha escolhida por um revendedor). */
  accountId: string;
  /** Contas que o usuário pode administrar/alternar. */
  manageableAccountIds: string[];
  isSuperadmin: boolean;
  isAdmin: boolean;
  /** Telas liberadas para o usuário; null = todas as telas da conta. */
  screenIds: string[] | null;
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
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

/**
 * Autentica o usuário do painel e resolve a conta ativa e as telas permitidas.
 * `minRole: "admin"` bloqueia operadores.
 */
export async function requireUser(request: Request, options: { minRole?: "admin" | "superadmin" } = {}): Promise<AuthContext> {
  const token = getBearerToken(request) ?? getCookie(request, ADMIN_COOKIE_NAME);

  if (!token) {
    throw new ApiError(401, "unauthorized", "Autenticação obrigatória.");
  }

  const payload = verifyAdminToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountId: true,
      avatarUrl: true,
      timezone: true,
      isActive: true,
      restrictContent: true,
      account: { select: { id: true, kind: true, isActive: true } },
      screenAccess: { select: { screenId: true } }
    }
  });

  if (!user || !user.isActive || !user.accountId || !user.account) {
    throw new ApiError(401, "unauthorized", "Usuário inativo ou inexistente.");
  }

  if (!user.account.isActive && user.role !== "superadmin") {
    throw new ApiError(403, "account_disabled", "Esta conta está desativada.");
  }

  const isSuperadmin = user.role === "superadmin";
  const isAdmin = isSuperadmin || user.role === "admin";

  if (options.minRole === "superadmin" && !isSuperadmin) {
    throw new ApiError(403, "forbidden", "Acesso restrito ao administrador da plataforma.");
  }

  if (options.minRole === "admin" && !isAdmin) {
    throw new ApiError(403, "forbidden", "Acesso restrito a administradores.");
  }

  const manageableAccountIds = await getManageableAccountIds(user.accountId, user.account.kind, isSuperadmin, isAdmin);
  const requestedAccountId = getCookie(request, ACCOUNT_COOKIE_NAME);
  const accountId =
    requestedAccountId && manageableAccountIds.includes(requestedAccountId) ? requestedAccountId : user.accountId;
  const restricted = user.role === "operator" && user.restrictContent && accountId === user.accountId;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountId: user.accountId,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      restrictContent: user.restrictContent
    },
    accountId,
    manageableAccountIds,
    isSuperadmin,
    isAdmin,
    screenIds: restricted ? user.screenAccess.map((access) => access.screenId) : null
  };
}

/** Mantido para compatibilidade: exige administrador. */
export function requireAdmin(request: Request) {
  return requireUser(request, { minRole: "admin" });
}

async function getManageableAccountIds(accountId: string, kind: string, isSuperadmin: boolean, isAdmin: boolean) {
  if (isSuperadmin) {
    const accounts = await prisma.account.findMany({ select: { id: true } });
    return accounts.map((account) => account.id);
  }

  if (isAdmin && kind === "reseller") {
    const children = await prisma.account.findMany({ where: { parentId: accountId }, select: { id: true } });
    return [accountId, ...children.map((child) => child.id)];
  }

  return [accountId];
}

export function assertScreenAllowed(ctx: AuthContext, screenId: string) {
  if (ctx.screenIds && !ctx.screenIds.includes(screenId)) {
    throw new ApiError(404, "screen_not_found", "Tela não encontrada.");
  }
}

export function screenScope(ctx: AuthContext) {
  return {
    accountId: ctx.accountId,
    ...(ctx.screenIds ? { id: { in: ctx.screenIds } } : {})
  };
}

export function getDeviceKeyFromRequest(request: Request) {
  const headerKey = request.headers.get("x-device-key")?.trim();
  const bearerKey = getBearerToken(request);
  return headerKey || bearerKey || null;
}

export function hashDeviceKey(deviceKey: string) {
  return crypto.createHash("sha256").update(deviceKey).digest("hex");
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyAdminToken(token: string): AdminTokenPayload {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    throw new ApiError(401, "invalid_token", "Sessão inválida. Entre novamente.");
  }

  let payload: AdminTokenPayload;

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminTokenPayload;
  } catch {
    throw new ApiError(401, "invalid_token", "Sessão inválida. Entre novamente.");
  }

  if (!payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, "invalid_token", "Sessão expirada. Entre novamente.");
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

export function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

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

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
