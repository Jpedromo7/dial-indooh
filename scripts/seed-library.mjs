// Cadastra conteúdos dinâmicos prontos na Biblioteca (visíveis para todos os clientes).
// Idempotente: não duplica (procura pelo título); em itens que já existem, só completa a foto de fundo se faltar.
// Uso: DATABASE_URL=... node scripts/seed-library.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const year = new Date().getFullYear();

// Mesmas fotos da galeria do painel (packages/shared WIDGET_BACKGROUNDS). Licença Unsplash.
const photo = (id) => `https://images.unsplash.com/photo-${id}?w=1920&q=70&fm=jpg&fit=crop`;
const BG = {
  halteres: photo("1576678927484-cc907957088c"),
  academiaEscura: photo("1778828494354-9b717d36dc99"),
  barra: photo("1521805103424-d8f8430e8933"),
  treinoFeminino: photo("1541534741688-6078c6bfb5c5"),
  treinoMasculino: photo("1605296867304-46d5465a13f1"),
  esteiras: photo("1757924284732-4189190321cf"),
  agua: photo("1523362628745-0c100150b504"),
  alimentacao: photo("1512621776951-a57141f2eefd"),
  alongamento: photo("1552196563-55cd4e45efb3"),
  ceu: photo("1513002749550-c59d786b8e6c"),
  cidade: photo("1605702012553-e954fbde66eb"),
  moedas: photo("1534951009808-766178b47a4f"),
  calendario: photo("1535981767287-35259dbf7d0e"),
  festa: photo("1513151233558-d860c5398176"),
  jornal: photo("1504711434969-e33886168f5c")
};

const ITEMS = [
  { title: "Hora certa", type: "clock", durationSeconds: 15, category: "Utilidades", config: { background: "#1d4ed8", color: "#ffffff", logoUrl: null, backgroundImageUrl: BG.cidade } },
  { title: "Cotação do dólar e euro", type: "currency", durationSeconds: 15, category: "Utilidades", config: { background: "#6d28d9", color: "#ffffff", currencies: ["USD", "EUR"], backgroundImageUrl: BG.moedas } },
  { title: "Clima (cidade do terminal)", type: "weather", durationSeconds: 15, category: "Utilidades", config: { background: "#0369a1", color: "#ffffff", city: null, state: null, backgroundImageUrl: BG.ceu } },
  { title: "Próximos feriados", type: "holidays", durationSeconds: 15, category: "Utilidades", config: { title: "Próximos feriados", count: 4, background: "#15803d", color: "#ffffff", backgroundImageUrl: BG.calendario } },
  { title: "Notícias do Brasil (G1)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://g1.globo.com/dynamo/brasil/rss2.xml", source: "G1 Brasil", background: "#111827", color: "#ffffff", logoUrl: null, maxItems: 3, backgroundImageUrl: BG.jornal } },
  { title: "Economia (G1)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://g1.globo.com/dynamo/economia/rss2.xml", source: "G1 Economia", background: "#0c4a6e", color: "#ffffff", logoUrl: null, maxItems: 3, backgroundImageUrl: BG.jornal } },
  { title: "Saúde e ciência (G1)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://g1.globo.com/dynamo/ciencia-e-saude/rss2.xml", source: "G1 Saúde", background: "#065f46", color: "#ffffff", logoUrl: null, maxItems: 3, backgroundImageUrl: BG.jornal } },
  { title: "Tecnologia (G1)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://g1.globo.com/dynamo/tecnologia/rss2.xml", source: "G1 Tecnologia", background: "#312e81", color: "#ffffff", logoUrl: null, maxItems: 3, backgroundImageUrl: BG.jornal } },
  { title: "Esportes (ge)", type: "rss", durationSeconds: 25, category: "Notícias", config: { url: "https://ge.globo.com/rss/ge/", source: "ge", background: "#14532d", color: "#ffffff", logoUrl: null, maxItems: 3, backgroundImageUrl: BG.jornal } },
  { title: "Frase motivacional do dia", type: "quote", durationSeconds: 15, category: "Entretenimento", config: { theme: "motivacional", title: "Frase do dia", phrases: [], background: "#0f766e", color: "#ffffff", backgroundImageUrl: BG.ceu } },
  { title: "Você sabia? (curiosidades)", type: "quote", durationSeconds: 15, category: "Entretenimento", config: { theme: "curiosidades", title: "Você sabia?", phrases: [], background: "#9a3412", color: "#ffffff", backgroundImageUrl: BG.jornal } },
  { title: "Dica de saúde do dia", type: "quote", durationSeconds: 15, category: "Entretenimento", config: { theme: "saude", title: "Dica de saúde", phrases: [], background: "#047857", color: "#ffffff", backgroundImageUrl: BG.alimentacao } },
  {
    title: `Contagem para o Natal ${year}`,
    type: "countdown",
    durationSeconds: 15,
    category: "Datas comemorativas",
    config: { title: "Faltam para o Natal", target: `${year}-12-25T03:00:00.000Z`, finishedText: "Feliz Natal!", background: "#be123c", color: "#ffffff", imageUrl: null, backgroundImageUrl: BG.festa }
  },
  {
    title: `Contagem para o Ano Novo ${year + 1}`,
    type: "countdown",
    durationSeconds: 15,
    category: "Datas comemorativas",
    config: { title: `Faltam para ${year + 1}`, target: `${year + 1}-01-01T03:00:00.000Z`, finishedText: `Feliz ${year + 1}!`, background: "#1e1b4b", color: "#fde68a", imageUrl: null, backgroundImageUrl: BG.festa }
  },
  // ---------- Academia ----------
  {
    title: "Academia: guarde os pesos",
    type: "quote",
    durationSeconds: 12,
    category: "Academia",
    config: { theme: "academia", title: "Atenção, aluno", phrases: [], background: "#0b1220", color: "#ffffff", backgroundImageUrl: BG.halteres }
  },
  {
    title: "Academia: motivação de treino",
    type: "quote",
    durationSeconds: 12,
    category: "Academia",
    config: { theme: "treino", title: "Bora treinar", phrases: [], background: "#4c1d95", color: "#ffffff", backgroundImageUrl: BG.treinoFeminino }
  },
  {
    title: "Academia: hidratação e saúde",
    type: "quote",
    durationSeconds: 12,
    category: "Academia",
    config: { theme: "saude", title: "Dica de saúde", phrases: [], background: "#0c4a6e", color: "#ffffff", backgroundImageUrl: BG.agua }
  },
  {
    title: "Notícias fitness (Boa Forma)",
    type: "rss",
    durationSeconds: 25,
    category: "Academia",
    config: { url: "https://boaforma.abril.com.br/feed/", source: "Boa Forma", background: "#111827", color: "#ffffff", logoUrl: null, maxItems: 3, backgroundImageUrl: BG.esteiras }
  },
  {
    title: "Famosos fitness",
    type: "rss",
    durationSeconds: 25,
    category: "Academia",
    config: {
      url: "https://news.google.com/rss/search?q=famosos+treino+OR+academia+OR+dieta+when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
      source: "Famosos fitness",
      background: "#831843",
      color: "#ffffff",
      logoUrl: null,
      maxItems: 3,
      backgroundImageUrl: BG.treinoMasculino
    }
  }
];

async function main() {
  const root = await prisma.account.findFirst({ where: { kind: "reseller", parentId: null }, orderBy: { createdAt: "asc" } });

  if (!root) {
    throw new Error("Conta raiz não encontrada. Rode scripts/migrate-v2.mjs antes.");
  }

  let created = 0;
  let updated = 0;
  for (const item of ITEMS) {
    const exists = await prisma.media.findFirst({ where: { isLibrary: true, title: item.title, type: item.type } });
    if (exists) {
      const current = exists.config ?? {};
      if (item.config.backgroundImageUrl && !current.backgroundImageUrl) {
        await prisma.media.update({ where: { id: exists.id }, data: { config: { ...current, backgroundImageUrl: item.config.backgroundImageUrl } } });
        updated += 1;
      }
      continue;
    }

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

  console.log(`${created} conteúdo(s) criado(s); ${updated} ganharam foto de fundo; ${ITEMS.length - created} já existiam.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
