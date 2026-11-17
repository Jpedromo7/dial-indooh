# D Player Platform

Plataforma de mídia indoor (digital signage) para TVs e Android TV boxes: painel web para gerenciar terminais, conteúdos, agendamentos e relatórios, e um app Android TV que toca a programação mesmo sem internet.

## Funcionalidades

- **Multi-conta (revenda → clientes)**: cada cliente tem os próprios terminais, mídias, grupos, empresas e usuários. Revendas criam clientes, alternam entre contas e definem limites de terminais.
- **Usuários e permissões**: administradores e operadores; operadores podem ficar restritos a terminais específicos.
- **Terminais**: cadastro completo (empresa, segmento, endereço com CEP/IBGE, funcionamento, fluxo de pessoas, classe social, som, fuso, ciclo de atualização, rodapé), favoritos, anotações, duplicar, trocar aparelho (novo código), diagnóstico (espaço livre, mídias baixadas, modelo).
- **Lista de reprodução por terminal**: mídias e grupos na ordem desejada, embaralhar, reprodução aleatória contínua.
- **Mídias**: vídeo/imagem com versões horizontal e vertical, link do YouTube, link externo, empresa, categoria, duração, gravar estatísticas, **agendamento por mídia** (período, faixa de horário, dias da semana).
- **Conteúdos dinâmicos** com prévia ao vivo: hora certa, cotação (dólar, euro…), clima, notícias RSS, avisos e Instagram.
- **Barra de rodapé**: logo, frase ou manchetes RSS rolando, data, hora e clima.
- **Biblioteca**: conteúdos prontos publicados pela plataforma para todos os clientes.
- **Relatórios de exibição** (comprovação) por mídia, grupo, terminal e empresa, com exportação em PDF e Excel.
- **Painel inicial** com terminais online, exibições do mês, saúde dos terminais e notificações.
- **Controle remoto e espelhamento de tela** em tempo real.
- **White-label**: logo do painel, imagem da tela de login e tela de abertura da TV.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL (Neon)
- Cloudflare R2 para arquivos
- Expo React Native para Android TV
- npm workspaces (`apps/web`, `apps/tv`, `packages/shared`)

## Desenvolvimento

```bash
npm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
npm run prisma:generate
npx prisma db push --schema prisma/schema.prisma
node scripts/migrate-v2.mjs   # cria a conta raiz e migra dados antigos (idempotente)
npm run dev:web
```

Testes:

```bash
npm test -w @dialindooh/web                     # testes unitários (Vitest)
BASE_URL=http://localhost:3000 QA_EMAIL=... QA_PASSWORD=... node scripts/smoke-test.mjs   # ponta a ponta
```

## Variáveis importantes

Veja `.env.example`. Em produção: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (24+ caracteres), `CRON_SECRET`, `MEDIA_STORAGE_PROVIDER=r2`, `R2_*`, `MEDIA_STORAGE_BUCKET`, `MEDIA_STORAGE_PUBLIC_URL`.

Rotinas diárias (Vercel Cron): `/api/cron/keepalive` e `/api/cron/maintenance` (retenção de logs e renovação de tokens do Instagram).

## App da TV

```bash
cd apps/tv
npx eas-cli build -p android --profile preview   # gera o APK
```

Instalação na TV box: app **Downloader** → digite `https://<seu-painel>/apk` → instale → libere "Sobrepor outros apps" → digite o código de ativação do terminal. O link do APK é configurado em **Configurações → Aplicativo da TV**.

APKs antigos (0.1.x) continuam funcionando pela rota `/api/screens/:id/playlist` (somente imagens e vídeos) até serem atualizados.
