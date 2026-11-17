// Migração de dados para a plataforma v2 (multi-conta, lista por terminal, chave de dispositivo com hash).
// Idempotente: pode ser executado várias vezes. Uso: DATABASE_URL=... node scripts/migrate-v2.mjs
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HEARTBEAT_RETENTION_DAYS = Number(process.env.HEARTBEAT_RETENTION_DAYS ?? 90);

async function main() {
  let root = await prisma.account.findFirst({ where: { kind: "reseller", parentId: null }, orderBy: { createdAt: "asc" } });

  if (!root) {
    root = await prisma.account.create({ data: { name: process.env.ROOT_ACCOUNT_NAME ?? "D Player", kind: "reseller" } });
    console.log(`Conta raiz criada: ${root.id}`);
  }

  const [users, screens, media, playlists] = await Promise.all([
    prisma.user.updateMany({ where: { accountId: null }, data: { accountId: root.id } }),
    prisma.screen.updateMany({ where: { accountId: null }, data: { accountId: root.id } }),
    prisma.media.updateMany({ where: { accountId: null }, data: { accountId: root.id } }),
    prisma.playlist.updateMany({ where: { accountId: null }, data: { accountId: root.id } })
  ]);
  console.log(`Vinculados à conta raiz: ${users.count} usuários, ${screens.count} telas, ${media.count} mídias, ${playlists.count} grupos.`);

  const firstUser = await prisma.user.findFirst({ where: { accountId: root.id }, orderBy: { createdAt: "asc" } });
  if (firstUser && firstUser.role !== "superadmin") {
    await prisma.user.update({ where: { id: firstUser.id }, data: { role: "superadmin" } });
    console.log(`Usuário ${firstUser.email} promovido a superadmin.`);
  }

  const defaultCompany = await prisma.company.findFirst({ where: { accountId: root.id, name: "Avulso" } });
  if (!defaultCompany) {
    await prisma.company.create({ data: { accountId: root.id, name: "Avulso" } });
  }

  const assignments = await prisma.screenAssignment.findMany({ where: { isActive: true } });
  for (const assignment of assignments) {
    const existing = await prisma.screenItem.count({ where: { screenId: assignment.screenId } });
    if (existing === 0) {
      await prisma.screenItem.create({ data: { screenId: assignment.screenId, playlistId: assignment.playlistId, order: 1 } });
      console.log(`Tela ${assignment.screenId}: grupo ${assignment.playlistId} copiado para a lista própria.`);
    }
  }

  const legacyKeys = await prisma.screen.findMany({ where: { deviceKey: { not: null }, deviceKeyHash: null } });
  for (const screen of legacyKeys) {
    await prisma.screen.update({
      where: { id: screen.id },
      data: { deviceKeyHash: sha256(screen.deviceKey), deviceKey: null, activationCode: null }
    });
  }
  if (legacyKeys.length) console.log(`${legacyKeys.length} chave(s) de dispositivo convertida(s) para hash.`);

  if (process.env.PRUNE_LOGS !== "1") return;

  const cutoff = new Date(Date.now() - HEARTBEAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const pruned = await prisma.screenHeartbeat.deleteMany({ where: { sentAt: { lt: cutoff } } });
  const prunedEvents = await prisma.screenEvent.deleteMany({ where: { createdAt: { lt: cutoff }, level: "info" } });
  console.log(`Limpeza: ${pruned.count} heartbeats e ${prunedEvents.count} eventos antigos removidos.`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
