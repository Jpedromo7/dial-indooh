// Cadastra conteúdos dinâmicos prontos na Biblioteca (visíveis para todos os clientes).
// Idempotente: não duplica (procura pelo título). Uso: DATABASE_URL=... node scripts/seed-library.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const year = new Date().getFullYear();

const ITEMS = [
  { title: "Hora certa", type: "clock", durationSeconds: 15, category: "Utilidades", config: { background: "#1d4ed8", color: "#ffffff", logoUrl: null } },
  { title: "Cotação do dólar e euro", type: "currency", durationSeconds: 15, category: "Utilidades", config: { background: "#6d28d9", color: "#ffffff", currencies: ["USD", "EUR"] } },
  { title: "Clima (cidade do terminal)", type: "weather", durationSeconds: 15, category: "Utilidades", config: { background: "#0369a1", color: "#ffffff", city: null, state: null } },
  { title: "Próximos feriados", type: "holidays", durationSeconds: 15, category: "Utilidades", config: { title: "Próximos feriados", count: 4, background: "#15803d", color: "#ffffff" } },
  { title: "Notícias do Brasil (G1)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://g1.globo.com/dynamo/brasil/rss2.xml", source: "G1 Brasil", background: "#111827", color: "#ffffff", logoUrl: null, maxItems: 3 } },
  { title: "Economia (G1)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://g1.globo.com/dynamo/economia/rss2.xml", source: "G1 Economia", background: "#0c4a6e", color: "#ffffff", logoUrl: null, maxItems: 3 } },
  { title: "Saúde e ciência (G1)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://g1.globo.com/dynamo/ciencia-e-saude/rss2.xml", source: "G1 Saúde", background: "#065f46", color: "#ffffff", logoUrl: null, maxItems: 3 } },
  { title: "Tecnologia (G1)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://g1.globo.com/dynamo/tecnologia/rss2.xml", source: "G1 Tecnologia", background: "#312e81", color: "#ffffff", logoUrl: null, maxItems: 3 } },
  { title: "Esportes (ge)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://ge.globo.com/rss/ge/", source: "ge", background: "#14532d", color: "#ffffff", logoUrl: null, maxItems: 3 } },
  { title: "Frase motivacional do dia", type: "quote", durationSeconds: 15, category: "Entretenimento", config: { theme: "motivacional", title: "Frase do dia", phrases: [], background: "#0f766e", color: "#ffffff" } },
  { title: "Você sabia? (curiosidades)", type: "quote", durationSeconds: 15, category: "Entretenimento", config: { theme: "curiosidades", title: "Você sabia?", phrases: [], background: "#9a3412", color: "#ffffff" } },
  { title: "Dica de saúde do dia", type: "quote", durationSeconds: 15, category: "Entretenimento", config: { theme: "saude", title: "Dica de saúde", phrases: [], background: "#047857", color: "#ffffff" } },
  {
    title: `Contagem para o Natal ${year}`,
    type: "countdown",
    durationSeconds: 15,
    category: "Datas comemorativas",
    config: { title: "Faltam para o Natal", target: `${year}-12-25T03:00:00.000Z`, finishedText: "Feliz Natal!", background: "#be123c", color: "#ffffff", imageUrl: null }
  },
  {
    title: `Contagem para o Ano Novo ${year + 1}`,
    type: "countdown",
    durationSeconds: 15,
    category: "Datas comemorativas",
    config: { title: `Faltam para ${year + 1}`, target: `${year + 1}-01-01T03:00:00.000Z`, finishedText: `Feliz ${year + 1}!`, background: "#1e1b4b", color: "#fde68a", imageUrl: null }
  }
];

async function main() {
  const root = await prisma.account.findFirst({ where: { kind: "reseller", parentId: null }, orderBy: { createdAt: "asc" } });

  if (!root) {
    throw new Error("Conta raiz não encontrada. Rode scripts/migrate-v2.mjs antes.");
  }

  let created = 0;
  for (const item of ITEMS) {
    const exists = await prisma.media.findFirst({ where: { isLibrary: true, title: item.title, type: item.type } });
    if (exists) continue;

    await prisma.media.create({
      data: {
        accountId: root.id,
        isLibrary: true,
        title: item.title,
        type: item.type,
        category: item.category,
        durationSeconds: item.durationSeconds,
        config: item.config,
        recordStats: true,
        status: "ready",
        readyAt: new Date()
      }
    });
    created += 1;
  }

  console.log(`${created} conteúdo(s) criado(s); ${ITEMS.length - created} já existiam.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
