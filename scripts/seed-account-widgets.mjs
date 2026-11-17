// Cria conteúdos dinâmicos de exemplo, editáveis, na conta de um usuário (aparecem em "Criados").
// Idempotente por título. Uso: DATABASE_URL=... ACCOUNT_EMAIL=admin@... node scripts/seed-account-widgets.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const year = new Date().getFullYear();

const ITEMS = [
  { title: "Hora certa", type: "clock", durationSeconds: 15, config: { background: "#1d4ed8", color: "#ffffff", logoUrl: null } },
  { title: "Cotação do dólar e euro", type: "currency", durationSeconds: 15, config: { background: "#6d28d9", color: "#ffffff", currencies: ["USD", "EUR"] } },
  { title: "Clima", type: "weather", durationSeconds: 15, config: { background: "#0369a1", color: "#ffffff", city: null, state: null } },
  { title: "Notícias do Brasil (G1)", type: "rss", durationSeconds: 25, config: { url: "https://g1.globo.com/dynamo/brasil/rss2.xml", source: "G1", background: "#111827", color: "#ffffff", logoUrl: null, maxItems: 3 } },
  { title: "Esportes (ge)", type: "rss", durationSeconds: 25, config: { url: "https://ge.globo.com/rss/ge/", source: "ge", background: "#14532d", color: "#ffffff", logoUrl: null, maxItems: 3 } },
  { title: "Aviso de boas-vindas", type: "notice", durationSeconds: 12, config: { text: "Seja bem-vindo!", subtitle: "Aproveite nossas ofertas de hoje", background: "#b91c1c", color: "#ffffff", imageUrl: null } },
  { title: "Frase motivacional do dia", type: "quote", durationSeconds: 15, config: { theme: "motivacional", title: "Frase do dia", phrases: [], background: "#0f766e", color: "#ffffff" } },
  { title: "Você sabia?", type: "quote", durationSeconds: 15, config: { theme: "curiosidades", title: "Você sabia?", phrases: [], background: "#9a3412", color: "#ffffff" } },
  { title: "Dica de saúde do dia", type: "quote", durationSeconds: 15, config: { theme: "saude", title: "Dica de saúde", phrases: [], background: "#047857", color: "#ffffff" } },
  {
    title: `Contagem para o Natal ${year}`,
    type: "countdown",
    durationSeconds: 15,
    config: { title: "Faltam para o Natal", target: `${year}-12-25T03:00:00.000Z`, finishedText: "Feliz Natal!", background: "#be123c", color: "#ffffff", imageUrl: null }
  },
  { title: "Próximos feriados", type: "holidays", durationSeconds: 15, config: { title: "Próximos feriados", count: 4, background: "#15803d", color: "#ffffff" } }
];

async function main() {
  const email = process.env.ACCOUNT_EMAIL;
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  if (!user?.accountId) {
    throw new Error("Informe ACCOUNT_EMAIL de um usuário existente.");
  }

  let created = 0;
  for (const item of ITEMS) {
    const exists = await prisma.media.findFirst({ where: { accountId: user.accountId, isLibrary: false, title: item.title, type: item.type } });
    if (exists) continue;

    await prisma.media.create({
      data: {
        accountId: user.accountId,
        title: item.title,
        type: item.type,
        durationSeconds: item.durationSeconds,
        config: item.config,
        recordStats: true,
        status: "ready",
        readyAt: new Date()
      }
    });
    created += 1;
  }

  console.log(`${created} conteúdo(s) criado(s) na conta; ${ITEMS.length - created} já existiam.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
