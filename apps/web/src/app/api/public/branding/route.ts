import { prisma } from "@/server/db";
import { apiRoute } from "@/server/http";

export const runtime = "nodejs";

/** Imagem e cores da tela de login (conta raiz da plataforma). */
export const GET = apiRoute(async () => {
  const account = await prisma.account.findFirst({
    where: { parentId: null, kind: "reseller" },
    orderBy: { createdAt: "asc" },
    select: { name: true, logoUrl: true, loginImageUrl: true, primaryColor: true }
  });

  return account ?? { name: "D Player", logoUrl: null, loginImageUrl: null, primaryColor: null };
});
