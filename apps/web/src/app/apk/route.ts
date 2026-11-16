import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Link curto para instalar o app na TV (digite no app "Downloader": <seu-domínio>/apk).
 * Usa o link configurado na conta raiz ou a variável APK_DOWNLOAD_URL.
 */
export async function GET() {
  const account = await prisma.account
    .findFirst({ where: { parentId: null, apkUrl: { not: null } }, orderBy: { createdAt: "asc" }, select: { apkUrl: true } })
    .catch(() => null);
  const target = account?.apkUrl ?? process.env.APK_DOWNLOAD_URL;

  if (!target) {
    return new NextResponse("Link do APK ainda não configurado. Configure em Configurações > Aplicativo da TV.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  return NextResponse.redirect(target, 302);
}
