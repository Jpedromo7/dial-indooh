// Teste ponta a ponta da API (painel + TV). Uso:
//   BASE_URL=http://localhost:3000 QA_EMAIL=... QA_PASSWORD=... node scripts/smoke-test.mjs
// Cria dados de teste com prefixo "[QA]" e remove tudo no final.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STORAGE = (process.env.MEDIA_STORAGE_PUBLIC_URL ?? "https://cdn.dial.test").replace(/\/+$/, "");
let cookie = "";
let failures = 0;
const created = { screens: [], media: [], playlists: [], companies: [], users: [], accounts: [] };

async function call(method, path, body, headers = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie && setCookie.includes("dial_indooh_admin=")) {
    cookie = setCookie
      .split(/,(?=\s*\w+=)/)
      .map((part) => part.split(";")[0].trim())
      .filter((part) => !part.endsWith("="))
      .join("; ");
  }
  const type = response.headers.get("content-type") ?? "";
  const payload = type.includes("json") ? await response.json() : await response.arrayBuffer();
  return { status: response.status, payload, headers: response.headers };
}

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ✔ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✘ ${name}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : "");
  }
}

async function main() {
  console.log(`Smoke test em ${BASE}`);

  console.log("Autenticação");
  const unauth = await call("GET", "/api/screens");
  check("API sem sessão retorna 401", unauth.status === 401, unauth.status);
  const badLogin = await call("POST", "/api/auth/login", { email: process.env.QA_EMAIL, password: "senha-errada-123" });
  check("senha errada retorna 401", badLogin.status === 401, badLogin.status);
  const login = await call("POST", "/api/auth/login", { email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD });
  check("login ok", login.status === 200, login.payload);
  const session = await call("GET", "/api/session");
  check("sessão carrega conta", session.payload?.data?.account?.id, session.payload);
  const page = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check("página sem cookie redireciona para login", page.status === 307 || page.status === 308, page.status);

  console.log("Empresas e terminais");
  const company = await call("POST", "/api/companies", { name: "[QA] Empresa" });
  check("cria empresa", company.status === 201, company.payload);
  created.companies.push(company.payload.data?.id);
  const screen = await call("POST", "/api/screens", {
    name: "[QA] Recepção",
    orientation: "landscape",
    companyId: company.payload.data?.id,
    segment: "Academias",
    city: "Fortaleza",
    state: "CE",
    openFrom: "07:00",
    openTo: "22:00",
    openDays: [1, 2, 3, 4, 5],
    socialClasses: ["A", "B"],
    footerEnabled: true,
    soundEnabled: true,
    timezone: "America/Fortaleza"
  });
  check("cria terminal com campos completos", screen.status === 201 && screen.payload.data?.activationCode?.length === 8, screen.payload);
  const screenId = screen.payload.data?.id;
  created.screens.push(screenId);

  console.log("Mídias");
  const badUrl = await call("POST", "/api/media", { title: "[QA] fora", type: "image", fileUrl: "https://evil.example.com/x.jpg", mimeType: "image/jpeg", sizeBytes: 10 });
  check("bloqueia arquivo fora do bucket", badUrl.status === 422, badUrl.payload);
  const image = await call("POST", "/api/media", {
    title: "[QA] Imagem",
    type: "image",
    fileUrl: `${STORAGE}/uploads/qa-h.jpg`,
    fileUrlVertical: `${STORAGE}/uploads/qa-v.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1000,
    durationSeconds: 12,
    companyId: company.payload.data?.id,
    schedule: { startsAt: null, endsAt: null, timeFrom: "06:00", timeTo: "23:00", weekdays: [] },
    screenIds: [screenId]
  });
  check("cria imagem H+V incluída no terminal", image.status === 201 && image.payload.data?.screenCount === 1, image.payload);
  created.media.push(image.payload.data?.id);
  const clock = await call("POST", "/api/media", { title: "[QA] Hora", type: "clock", config: { background: "#112233", color: "#ffffff" } });
  check("cria widget hora certa", clock.status === 201, clock.payload);
  created.media.push(clock.payload.data?.id);
  const currency = await call("POST", "/api/media", { title: "[QA] Dólar", type: "currency", config: { currencies: ["USD", "EUR"] } });
  check("cria widget cotação", currency.status === 201, currency.payload);
  created.media.push(currency.payload.data?.id);
  const youtube = await call("POST", "/api/media", { title: "[QA] YT", type: "youtube", durationSeconds: 30, config: { url: "https://youtu.be/qxzQR5uwWsk" } });
  check("cria YouTube e extrai ID", youtube.status === 201 && youtube.payload.data?.config?.videoId === "qxzQR5uwWsk", youtube.payload);
  created.media.push(youtube.payload.data?.id);
  const badYoutube = await call("POST", "/api/media", { title: "[QA] YT ruim", type: "youtube", config: { url: "https://example.com" } });
  check("rejeita link de YouTube inválido", badYoutube.status === 422, badYoutube.payload);
  const notice = await call("POST", "/api/media", { title: "[QA] Aviso", type: "notice", config: { text: "Promoção hoje" } });
  created.media.push(notice.payload.data?.id);

  console.log("Grupos");
  const group = await call("POST", "/api/playlists", { name: "[QA] Grupo", mediaIds: [clock.payload.data?.id, notice.payload.data?.id], screenIds: [screenId] });
  check("cria grupo com mídias e terminal", group.status === 201 && group.payload.data?.items?.length === 2, group.payload);
  created.playlists.push(group.payload.data?.id);

  console.log("Lista do terminal");
  const items = await call("PUT", `/api/screens/${screenId}/items`, {
    items: [
      { mediaId: image.payload.data?.id },
      { playlistId: group.payload.data?.id },
      { mediaId: currency.payload.data?.id },
      { mediaId: youtube.payload.data?.id }
    ]
  });
  check("salva lista com 4 itens", items.status === 200 && items.payload.data?.length === 4, items.payload);
  const detail = await call("GET", `/api/screens/${screenId}`);
  check("detalhe traz itens, gráfico mensal e código", detail.payload.data?.items?.length === 4 && detail.payload.data?.monthlyPlays?.length === 12, detail.payload);

  console.log("TV: ativação e manifesto");
  const activation = await call("POST", "/api/screens/activate", { activationCode: screen.payload.data?.activationCode });
  check("ativa TV com código", activation.status === 201 && activation.payload.data?.deviceKey, activation.payload);
  const reuse = await call("POST", "/api/screens/activate", { activationCode: screen.payload.data?.activationCode });
  check("código não pode ser reutilizado", reuse.status === 404, reuse.status);
  const device = { "x-device-key": activation.payload.data?.deviceKey };
  const savedCookie = cookie;
  cookie = "";
  const manifest = await call("GET", `/api/screens/${screenId}/manifest`, undefined, device);
  check("manifesto v2", manifest.status === 200 && manifest.payload.data?.version === 2, manifest.payload);
  const manifestItems = manifest.payload.data?.items ?? [];
  check("grupo expandido (5 itens)", manifestItems.length === 5, manifestItems.map((item) => item.type));
  check("usa arquivo horizontal", manifestItems[0]?.fileUrl?.endsWith("qa-h.jpg"), manifestItems[0]);
  check("cotação com dados", Array.isArray(manifestItems.find((item) => item.type === "currency")?.data?.quotes));
  check("rodapé presente", manifest.payload.data?.footer !== null, manifest.payload.data?.footer);
  check("som e fuso do terminal", manifest.payload.data?.screen?.soundEnabled === true && manifest.payload.data?.screen?.timezone === "America/Fortaleza");
  const legacy = await call("GET", `/api/screens/${screenId}/playlist`, undefined, device);
  check("rota antiga só com arquivos", legacy.payload.data?.playlist?.items?.length === 1, legacy.payload);
  const wrongKey = await call("GET", `/api/screens/${screenId}/manifest`, undefined, { "x-device-key": "chave-errada" });
  check("chave errada bloqueada", wrongKey.status === 403, wrongKey.status);
  const heartbeat = await call("POST", `/api/screens/${screenId}/heartbeat`, {
    status: "online",
    appVersion: "2.0.0",
    currentMediaId: image.payload.data?.id,
    playbackState: "playing",
    diagnostics: { freeDiskBytes: 2e9, cachedItems: 1, totalItems: 1, deviceModel: "QA Box", overlayPermission: true }
  }, device);
  check("heartbeat com diagnóstico", heartbeat.status === 200, heartbeat.payload);
  const now = Date.now();
  const plays = await call("POST", `/api/screens/${screenId}/plays`, {
    plays: [
      { id: `qa-${now}-1`, mediaId: image.payload.data?.id, startedAt: new Date(now - 60000).toISOString(), durationSeconds: 12 },
      { id: `qa-${now}-2`, mediaId: image.payload.data?.id, startedAt: new Date(now - 30000).toISOString(), durationSeconds: 12 },
      { id: `qa-${now}-2`, mediaId: image.payload.data?.id, startedAt: new Date(now - 30000).toISOString(), durationSeconds: 12 }
    ]
  }, device);
  check("registra exibições (sem duplicar)", plays.status === 200 && plays.payload.data?.accepted === 3, plays.payload);
  cookie = savedCookie;

  console.log("Relatórios e painel");
  const today = new Date().toISOString().slice(0, 10);
  const report = await call("GET", `/api/reports?from=${today}&to=${today}&mediaId=${image.payload.data?.id}`);
  check("relatório conta 2 exibições", report.payload.data?.totalPlays === 2, report.payload);
  const pdf = await call("GET", `/api/reports/export?format=pdf&from=${today}&to=${today}&mediaId=${image.payload.data?.id}`);
  check("exporta PDF", pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf" && pdf.payload.byteLength > 500, pdf.status);
  const xlsx = await call("GET", `/api/reports/export?format=xlsx&from=${today}&to=${today}`);
  check("exporta Excel", xlsx.status === 200 && xlsx.payload.byteLength > 500, xlsx.status);
  const dashboard = await call("GET", "/api/dashboard");
  check("dashboard", dashboard.status === 200 && dashboard.payload.data?.screens?.total >= 1, dashboard.payload);
  const detailAfter = await call("GET", `/api/screens/${screenId}`);
  check("terminal online com diagnóstico", detailAfter.payload.data?.status === "online" && detailAfter.payload.data?.diagnostics?.deviceModel === "QA Box", detailAfter.payload.data?.diagnostics);

  console.log("Usuários e permissões");
  const operator = await call("POST", "/api/users", {
    name: "[QA] Operador",
    email: `qa-op-${now}@dial.local`,
    password: "Operador2026",
    role: "operator",
    restrictContent: true,
    screenIds: []
  });
  check("cria operador restrito", operator.status === 201, operator.payload);
  created.users.push(operator.payload.data?.id);
  const weakPassword = await call("POST", "/api/users", { name: "x", email: `qa-weak-${now}@dial.local`, password: "123", role: "operator" });
  check("rejeita senha fraca", weakPassword.status === 400, weakPassword.status);
  const adminCookie = cookie;
  cookie = "";
  await call("POST", "/api/auth/login", { email: `qa-op-${now}@dial.local`, password: "Operador2026" });
  const opScreens = await call("GET", "/api/screens");
  check("operador restrito não vê terminais", opScreens.status === 200 && opScreens.payload.data?.length === 0, opScreens.payload);
  const opDetail = await call("GET", `/api/screens/${screenId}`);
  check("operador não abre terminal de fora", opDetail.status === 404, opDetail.status);
  const opUsers = await call("GET", "/api/users");
  check("operador não lista usuários", opUsers.status === 403, opUsers.status);
  cookie = adminCookie;

  console.log("Clientes (multi-conta)");
  const client = await call("POST", "/api/accounts", {
    name: "[QA] Cliente",
    maxScreens: 1,
    admin: { name: "Admin Cliente", email: `qa-client-${now}@dial.local`, password: "Cliente2026" }
  });
  check("cria cliente com admin", client.status === 201, client.payload);
  created.accounts.push(client.payload.data?.id);
  cookie = "";
  await call("POST", "/api/auth/login", { email: `qa-client-${now}@dial.local`, password: "Cliente2026" });
  const clientScreens = await call("GET", "/api/screens");
  check("cliente não vê terminais da revenda", clientScreens.payload.data?.length === 0, clientScreens.payload);
  const clientMedia = await call("GET", `/api/media/${image.payload.data?.id}`);
  check("cliente não vê mídia da revenda", clientMedia.status === 404, clientMedia.status);
  const s1 = await call("POST", "/api/screens", { name: "[QA] Cliente tela 1" });
  const s2 = await call("POST", "/api/screens", { name: "[QA] Cliente tela 2" });
  check("limite de terminais do plano", s1.status === 201 && s2.status === 403, [s1.status, s2.status]);
  if (s1.payload.data?.id) await call("DELETE", `/api/screens/${s1.payload.data.id}`);
  cookie = adminCookie;

  console.log("Limpeza");
  for (const id of created.accounts.filter(Boolean)) await call("DELETE", `/api/accounts/${id}`);
  for (const id of created.users.filter(Boolean)) await call("DELETE", `/api/users/${id}`);
  for (const id of created.screens.filter(Boolean)) await call("DELETE", `/api/screens/${id}`);
  for (const id of created.playlists.filter(Boolean)) await call("DELETE", `/api/playlists/${id}`);
  for (const id of created.media.filter(Boolean)) await call("DELETE", `/api/media/${id}`);
  for (const id of created.companies.filter(Boolean)) await call("DELETE", `/api/companies/${id}`);
  console.log("  dados de teste removidos");

  console.log(failures ? `\n${failures} falha(s).` : "\nTudo certo.");
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
