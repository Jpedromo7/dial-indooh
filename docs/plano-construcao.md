# Plano de construção — Dial indooh

Base: análise dos 18 vídeos de referência (sistema concorrente) + código atual do Dial indooh.
Objetivo: chegar à paridade de funcionalidades com identidade própria (nome, marca, layout,
conteúdo da biblioteca e textos próprios — nada de logo, nome ou vídeos do concorrente).

---

## 1. O que o sistema de referência faz (por vídeo)

| # | Vídeo | Funcionalidade observada |
|---|-------|--------------------------|
| 1 | Criando terminal | Tipo do terminal (horizontal / vertical / mural). Formulário: imagem, nome, **empresa**, **segmento** (Geral, Academias, Farmácias, Padarias…), endereço completo (rua, nº, CEP, bairro, UF, cidade), 2 telefones, **período de funcionamento + dias da semana**, **fluxo médio de pessoas**, **classe social A–D**, orientação, **ciclo de atualização (min)**, **som on/off**, **fuso horário**, **ativar barra de rodapé**. Lista com filtro online/offline, "mídias baixadas 0/20 (2m5s)", última comunicação, duplicar. |
| 2 | Adicionando mídia | Tipos: **Vídeo/Imagem, Instagram, Mídia programática, Link externo, Link YouTube**. Campos: nome, empresa, categoria, **upload separado horizontal e vertical**, duração (s), **incluir direto nos terminais**, **gravar estatísticas**, botão agendamento. Aviso "só será inserida em terminais horizontais". |
| 3 | Instagram | Conta conectada por token (botão "obter token"), 1 ou 3 posts, empresa, duração, terminais. Atualiza 3x/dia (08:15, 13:15, 18:15). Limite de contas por plano (0/5). |
| 4 | YouTube | Nome, empresa, URL, duração, agendamento, terminais. |
| 5 | Agendamento | **Por mídia**: período (início/fim), faixa de horário, dias da semana (vazio = todos). |
| 6 | Notícias RSS | Feeds com imagem, título, fonte, URL, cor de fundo, cor da fonte. Aba "Fontes RSS" (catálogo de feeds). |
| 7 | Hora certa | Widget relógio: logo, cor fundo/fonte, **preview ao vivo**. |
| 8 | Cotação dólar | Widget USD→BRL: cor fundo/fonte, duração, preview. |
| 9 | Grupos | Conjunto de mídias com imagem, nome, mídias, terminais. Entra na playlist como um item ("2 mídias, ~15s"). Respeita orientação. |
| 10 | Relatórios | Filtro período, mídia, grupo, terminal → **exibições**, **dias de campanha**, exibições por terminal, última sincronização. **Exportar PDF e Excel**. (Proof-of-play.) |
| 11 | Barra de rodapé | Por conta: logo (300×150), cor fundo/fonte, frase padrão, liga/desliga frase, data, hora, clima, ícones, velocidade da transição. |
| 12 | Biblioteca | Catálogo de **conteúdos prontos** (grupos de vídeos por tema, clima, saúde, charadas…) com "Incluir nos terminais" em 1 clique. Tela do terminal: badges (Horizontal, App não baixado, Sem root, Notícia RSS), gráfico de exibições mensal, **anotações**, **lista de reprodução por terminal** com ordem, remover, **embaralhar**, total (26 mídias, 4m5s). |
| — | Downloader | Instalação do APK via app *Downloader* com **código curto** (URL curta). |
| — | Rodapé completo | Rodapé rodando na TV real. |
| — | Tela de abertura | Imagem de inicialização (splash) personalizada, opção "configuração global". |
| — | Tela de login | Imagem da tela de login do painel personalizável. |
| — | Usuários | Usuário com imagem, nome, **terminais permitidos**, e-mail, senha (medidor de força), fuso, avatar, **restringir conteúdos**. Coluna Admin / Desativado. |
| — | Sobrepor apps | Permissão Android "exibir sobre outros apps" para o player abrir sozinho no boot. |

Também visível: domínio **revenda.*** → modelo **revenda / white-label** (revendedor tem clientes,
cada cliente tem empresas, usuários e terminais). Dashboard: gauge de terminais online,
exibições mensais com variação %, saúde dos terminais (7 dias), melhores terminais,
terminais favoritos, anotações. Sino de notificações.

---

## 2. Comparação com o Dial indooh hoje

| Área | Dial hoje | Falta |
|------|-----------|-------|
| Contas | 1 papel `admin`, sem empresas | Revenda → Cliente (conta) → Empresas → Usuários, permissões por terminal |
| Terminal | nome, slug, local, orientação, código de ativação | Metadados comerciais, horário de funcionamento, som, fuso, ciclo, rodapé, duplicar, favoritos, anotações |
| Mídia | arquivo imagem/vídeo único | Variante H/V, YouTube, link externo, Instagram, widgets, categoria, empresa, stats on/off |
| Programação | playlist com agenda no nível da playlist | Agenda **por item/mídia** (data, faixa horária, dias) + lista por terminal |
| Grupos | `Playlist` ≈ grupo | Grupo como item dentro da lista do terminal |
| Widgets | — | Relógio, dólar, clima, RSS, avisos, Instagram |
| Rodapé | — | Ticker configurável |
| Biblioteca | — | Catálogo global de conteúdos |
| Relatórios | heartbeats/eventos | Log de exibição (proof-of-play), PDF/Excel |
| White-label | — | Logo, splash, imagem de login, domínio próprio |
| Distribuição APK | EAS | Link curto / código Downloader, auto-update |
| **Diferenciais seus** | **controle remoto, espelhamento WebRTC, kiosk** | Manter e destacar |

---

## 3. Arquitetura alvo (mudanças principais)

### 3.1 Modelo de dados (Prisma)

```
Reseller (revenda: nome, domínio, logo, cores, splashUrl, loginImageUrl, limites)
 └─ Account (cliente: plano, limites: terminais, contas instagram…)
     ├─ Company (empresa/anunciante — "Avulso" padrão)
     ├─ User (role: owner | admin | operator, timezone, restrictContent)
     │    └─ UserScreenAccess (userId, screenId)
     ├─ Screen (+ companyId, segment, address*, city/uf, phones, openFrom/openTo,
     │          openDays[], footfall, socialClass[], refreshMinutes, soundEnabled,
     │          timezone, footerEnabled, notes, isFavorite)
     ├─ Media (kind: image | video | youtube | url | instagram | rss | clock |
     │         currency | weather | notice | programmatic,
     │         fileHorizontalUrl, fileVerticalUrl, config Json, companyId,
     │         categoryId, durationSeconds, recordStats)
     ├─ MediaSchedule (mediaId, startsAt, endsAt, timeFrom, timeTo, weekdays[])
     ├─ Group (= Playlist atual) + GroupItem
     ├─ ScreenItem (screenId, order, mediaId? | groupId?, scheduleOverride?)
     ├─ FooterConfig (accountId, logo, colors, phrase, showDate/Time/Weather/Icons, speed)
     ├─ IntegrationInstagram (token cifrado, expiresAt, postsCount, lastFetch, cache Json)
     └─ RssFeed (url, title, source, colors, cache Json)
LibraryItem (global da revenda: grupo/mídia pronta, tema, thumb)
PlayLog (screenId, mediaId, groupId?, startedAt, durationMs)  ← particionar/agregar por dia
PlayDaily (screenId, mediaId, date, plays, seconds)          ← agregado para relatórios
```

Tudo com `accountId` e filtro obrigatório em cada query (helper `scoped(prisma, user)`).

### 3.2 Manifesto do player
`GET /screens/:id/manifest` passa a devolver a lista **já resolvida** para o terminal:
itens expandidos (grupos → mídias), variante certa por orientação, agenda de cada item,
config de widgets com dados em cache (cotação, clima, RSS, posts), config do rodapé,
som, fuso e ciclo. A TV decide localmente o que tocar em cada momento (funciona offline).

### 3.3 Dados externos (cron no servidor, nunca na TV)
- Cotação: AwesomeAPI `USD-BRL` a cada 30 min.
- Clima: Open-Meteo por cidade do terminal (lat/lon do IBGE).
- RSS: parse no servidor, guarda últimos N itens + imagem.
- Instagram: **API do Instagram com login Instagram (contas Business/Creator)** — a Basic Display API foi desligada em dez/2024. Refresh do token de longa duração antes de 60 dias. Baixar imagens para o seu storage (URLs do CDN expiram).
- YouTube: tocar via player embed (WebView/`react-native-youtube-iframe`). **Não baixar o vídeo** (viola ToS) → item só toca online; pular se offline.

### 3.4 Player (Expo / Android TV)
- Renderizadores: imagem, vídeo, YouTube, WebView (link externo), e componentes nativos para relógio, cotação, clima, RSS, aviso, Instagram (template próprio).
- Rodapé: faixa fixa inferior com ticker animado (Reanimated), data/hora/clima.
- Agenda local + fuso do terminal.
- Proof-of-play: grava `PlayLog` em fila local (SQLite) e envia em lote; idempotente por UUID.
- Boot: `RECEIVE_BOOT_COMPLETED` + overlay (já tem `SYSTEM_ALERT_WINDOW`) + tela guiando a liberar a permissão.
- Diagnóstico enviado no heartbeat: espaço livre, mídias baixadas/total, root, versão, RAM.
- Auto-update: OTA do Expo (já configurado) + checagem de nova versão de APK.

---

## 4. Fases

> Estimativas para 1 dev em tempo integral. Cada fase termina com algo entregável.

### Fase 0 — Fundação e segurança (1 semana)
- Commitar a migração R2 pendente; limpar `artifacts/`, logs, `dist`.
- Corrigir ressalvas do relatório anterior: invalidar código de ativação após uso, rate limit (login/ativação), `fileUrl` restrito ao bucket, middleware de rotas no painel, hash da `deviceKey`.
- Testes de base (Vitest) para services + CI (GitHub Actions: typecheck, lint, test).

### Fase 1 — Multi-tenant e usuários (2 semanas)
- Modelos `Reseller`, `Account`, `Company`, `User` com papéis, `UserScreenAccess`.
- Migrar dados atuais para uma conta padrão.
- Escopo por conta em todas as rotas; testes garantindo isolamento.
- Telas: Empresas, Usuários (com terminais permitidos, fuso, restringir conteúdo), Minha conta.
- White-label básico: logo, cores, imagem de login, splash por revenda/conta.

### Fase 2 — Terminal completo (1,5 semana)
- Campos comerciais (segmento, endereço, UF/cidade via IBGE, funcionamento, fluxo, classe social, som, fuso, ciclo, rodapé).
- Lista: online/offline, mídias baixadas X/Y + duração, última comunicação, duplicar, favoritos.
- Página do terminal: badges de saúde, anotações (rich text), gráfico de exibições, **lista de reprodução própria** com arrastar, remover, embaralhar, duração total.
- Tipos horizontal / vertical (mural na Fase 7).

### Fase 3 — Mídias e programação (2 semanas)
- Mídia com variantes H/V, categoria, empresa, "gravar estatísticas", incluir em terminais no cadastro.
- Agenda por mídia (período, faixa horária, dias) e override por item do terminal.
- Grupos como item de lista (expande no manifesto).
- Novos tipos: YouTube, Link externo.
- Thumbnails e duração automática de vídeo (ffprobe no upload ou no cliente).
- Novo manifesto resolvido + player atualizado (YouTube, WebView, agenda local).

### Fase 4 — Widgets / conteúdos dinâmicos (2 semanas)
- Crons de dados (cotação, clima, RSS) + tabela de cache.
- Editor com **preview ao vivo** no painel (mesmo componente visual do player via React Native Web ou HTML espelhado).
- Widgets: Hora certa, Cotação (USD, EUR, BTC opcional), Clima, Notícias RSS (catálogo de fontes), Avisos.
- Instagram (OAuth oficial, limite de contas por plano, atualização 3x/dia).

### Fase 5 — Rodapé (1 semana)
- Config por conta (logo, cores, frase, data/hora/clima/ícones, velocidade) e liga/desliga por terminal.
- Opcional: RSS rolando no rodapé.
- Player: faixa inferior com ticker, reduz área útil do conteúdo.

### Fase 6 — Relatórios e dashboard (1,5 semana)
- `PlayLog` + agregação diária por cron → `PlayDaily`.
- Relatório: período, mídia, grupo, terminal, empresa → exibições, dias de campanha, tabela por terminal; exportar **PDF** (`@react-pdf/renderer`) e **Excel** (`exceljs`).
- Dashboard: gauge online, exibições do mês vs mês anterior, saúde 7 dias, melhores terminais, favoritos, anotações.
- Notificações (sino): terminal offline > X min, armazenamento cheio, token Instagram expirando.

### Fase 7 — Biblioteca, distribuição e extras (1,5 semana)
- Biblioteca da revenda: cadastrar conteúdos prontos (grupos temáticos), incluir em terminais em 1 clique. **Conteúdo próprio ou licenciado.**
- Distribuição do APK: rota curta `/apk` + código no app Downloader, página de instalação com passo a passo (permissão sobrepor apps, iniciar no boot).
- Terminal tipo **mural** (vídeo wall / grade de telas) — opcional.
- Mídia programática — deixar por último (exige integração com SSP/ad server; avaliar demanda).

### Fase 8 — Seus diferenciais (contínuo)
- Controle remoto e espelhamento já existem: adicionar servidor TURN, gravar sessões no log, tela de diagnóstico remoto.
- Screenshot remoto sob demanda (mais leve que espelhamento) para comprovação.

**Total estimado: ~13–14 semanas** para paridade + diferenciais.

---

## 5. Ordem recomendada e porquê
1. **Fase 0 e 1 primeiro**: multi-tenant mexe em todas as tabelas; fazer depois custa o dobro.
2. **Fase 3 antes da 4**: widgets dependem do novo manifesto e da lista por terminal.
3. **Proof-of-play (Fase 6) começa a gravar log já na Fase 3** (só a coleta), para ter histórico quando a tela de relatórios ficar pronta.

## 6. Cuidados legais e de produto
- Não usar nome, logo, layout idêntico nem os vídeos da biblioteca do concorrente.
- YouTube: só embed, sempre online; Instagram: só API oficial e contas Business/Creator.
- RSS: exibir fonte; respeitar termos de cada portal.
- LGPD: capturas de tela/áudio e dados de usuários — termo de uso e consentimento.
