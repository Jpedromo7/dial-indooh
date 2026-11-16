"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import type {
  ClockConfig,
  CurrencyConfig,
  CurrencyQuote,
  InstagramConfig,
  MediaDto,
  NoticeConfig,
  RssConfig,
  RssItem,
  WeatherConfig,
  WeatherData,
  WidgetMediaType
} from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ErrorBanner } from "@/components/admin/error-banner";
import { describeSchedule, hasSchedule, IconButton, ImageUploadField } from "@/components/admin/pickers";
import { BaseMediaFields, baseFromMedia, basePayload, useMediaFormData, type BaseMediaState } from "@/components/media/media-base";
import {
  ClockPreview,
  CurrencyPreview,
  InstagramPreview,
  NoticePreview,
  RssPreview,
  WeatherPreview
} from "@/components/widgets/widget-preview";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ColorField, Field, Input, Select, Tabs, Textarea } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

const META: Record<WidgetMediaType, { title: string; description: string; defaultTitle: string; defaultConfig: Record<string, unknown> }> = {
  clock: {
    title: "Hora certa",
    description: "Relógio com data e o seu logotipo.",
    defaultTitle: "Hora certa",
    defaultConfig: { background: "#1d4ed8", color: "#ffffff", logoUrl: null }
  },
  currency: {
    title: "Cotação",
    description: "Cotação atualizada do dólar e outras moedas (atualiza a cada 30 min).",
    defaultTitle: "Cotação do dólar",
    defaultConfig: { background: "#6d28d9", color: "#ffffff", currencies: ["USD"] }
  },
  weather: {
    title: "Clima",
    description: "Temperatura e previsão. Sem cidade fixa, usa a cidade de cada terminal.",
    defaultTitle: "Clima",
    defaultConfig: { background: "#0369a1", color: "#ffffff", city: "", state: "" }
  },
  rss: {
    title: "Notícias RSS",
    description: "Manchetes de qualquer portal com feed RSS (atualiza a cada 20 min).",
    defaultTitle: "Notícias",
    defaultConfig: { url: "", source: "", background: "#111827", color: "#ffffff", logoUrl: null, maxItems: 5 }
  },
  notice: {
    title: "Avisos",
    description: "Recados rápidos na tela: promoções, horários, comunicados.",
    defaultTitle: "Aviso",
    defaultConfig: { text: "", subtitle: "", background: "#b91c1c", color: "#ffffff", imageUrl: null }
  },
  instagram: {
    title: "Instagram",
    description: "Últimas postagens de uma conta comercial ou de criador (atualiza 3x ao dia).",
    defaultTitle: "Instagram",
    defaultConfig: { postsCount: 1, background: "#111827", color: "#ffffff", profileImageUrl: null }
  }
};

export default function WidgetPage() {
  return (
    <Suspense>
      <WidgetPageContent />
    </Suspense>
  );
}

function WidgetPageContent() {
  const params = useParams<{ type: string }>();
  const type = params.type as WidgetMediaType;
  const meta = META[type];
  if (!meta) notFound();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const list = useApiQuery(() => apiClient.listMedia({ type }), [type]);
  const [editing, setEditing] = useState<MediaDto | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaDto | null>(null);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (searchParams.get("new")) setEditing("new");
    else if (editId && list.data) setEditing(list.data.find((item) => item.id === editId) ?? null);
  }, [list.data, searchParams]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.deleteMedia(deleteTarget.id);
      setDeleteTarget(null);
      if (editing !== "new" && editing?.id === deleteTarget.id) setEditing(null);
      await list.refresh({ silent: true });
      toast({ title: "Excluído", variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <AppShell description={meta.description} title={meta.title}>
      <div className="grid gap-5 xl:grid-cols-[20rem_1fr]">
        <Card className="h-fit bg-card/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Criados</CardTitle>
            <Button onClick={() => setEditing("new")} size="sm" type="button">
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </CardHeader>
          <CardContent className="grid gap-1">
            {list.error ? <ErrorBanner message={list.error} /> : null}
            {list.data?.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum criado ainda.</p> : null}
            {list.data?.map((item) => (
              <div
                className={`flex items-center gap-2 rounded-md px-2 py-2 ${editing !== "new" && editing?.id === item.id ? "bg-primary/10" : "hover:bg-muted/40"}`}
                key={item.id}
              >
                <span className="h-8 w-2 rounded" style={{ background: ((item.config as { background?: string } | null)?.background as string) ?? "#333" }} />
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(item)} type="button">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.screenCount ?? 0} terminal(is){hasSchedule(item.schedule) ? ` · ${describeSchedule(item.schedule)}` : ""}
                  </p>
                </button>
                <IconButton label="Editar" onClick={() => setEditing(item)}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label="Excluir" onClick={() => setDeleteTarget(item)} tone="danger">
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </CardContent>
        </Card>

        {editing ? (
          <WidgetEditor
            key={editing === "new" ? "new" : editing.id}
            media={editing === "new" ? null : editing}
            onCancel={() => {
              setEditing(null);
              router.replace(`/widgets/${type}`);
            }}
            onSaved={async () => {
              await list.refresh({ silent: true });
              setEditing(null);
              router.replace(`/widgets/${type}`);
            }}
            type={type}
          />
        ) : (
          <Card className="bg-card/40">
            <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-muted-foreground">Selecione um item ao lado ou crie um novo.</p>
              <Button onClick={() => setEditing("new")} type="button">
                <Plus className="h-4 w-4" /> Criar {meta.title.toLowerCase()}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <ConfirmDialog
        confirmLabel="Excluir"
        description={`"${deleteTarget?.title}" será removido de todos os terminais.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        open={Boolean(deleteTarget)}
        title="Excluir?"
      />
    </AppShell>
  );
}

function WidgetEditor({ type, media, onCancel, onSaved }: { type: WidgetMediaType; media: MediaDto | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const meta = META[type];
  const { toast } = useToast();
  const { companies, screens, screenIds } = useMediaFormData(true, media?.id ?? null);
  const [base, setBase] = useState<BaseMediaState>(() => baseFromMedia(media, { title: meta.defaultTitle, durationSeconds: 15 }));
  const [config, setConfig] = useState<Record<string, unknown>>(() => ({ ...meta.defaultConfig, ...((media?.config ?? {}) as Record<string, unknown>) }));
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [isSaving, setIsSaving] = useState(false);
  const [quotes, setQuotes] = useState<CurrencyQuote[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [rss, setRss] = useState<RssItem[]>([]);
  const [instagramToken, setInstagramToken] = useState("");
  const [instagramUser, setInstagramUser] = useState<string | null>(((media?.config as InstagramConfig | null)?.username as string | undefined) ?? null);
  const [rssSources, setRssSources] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const set = (key: string, value: unknown) => setConfig((current) => ({ ...current, [key]: value }));
  const portrait = orientation === "portrait";

  useEffect(() => {
    if (screenIds) setBase((current) => ({ ...current, screenIds }));
  }, [screenIds]);

  useEffect(() => {
    if (type === "rss") apiClient.listRssSources().then(setRssSources).catch(() => undefined);
  }, [type]);

  const previewKey = useMemo(
    () => JSON.stringify({ c: config.currencies, city: config.city, state: config.state, url: config.url }),
    [config.city, config.currencies, config.state, config.url]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (type === "currency") {
        apiClient.previewWidget({ type, currencies: config.currencies as string[] }).then((data) => setQuotes(data.quotes ?? [])).catch(() => undefined);
      }
      if (type === "weather") {
        apiClient
          .previewWidget({ type, city: (config.city as string) || "São Paulo", state: (config.state as string) || (config.city ? null : "SP") })
          .then((data) => setWeather(data.weather ?? null))
          .catch(() => setWeather(null));
      }
      if (type === "rss" && config.url) {
        apiClient.previewWidget({ type, url: config.url as string }).then((data) => setRss(data.rss ?? [])).catch(() => setRss([]));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [previewKey, type]); // eslint-disable-line react-hooks/exhaustive-deps

  async function verifyInstagram() {
    try {
      const profile = await apiClient.verifyInstagram(instagramToken.trim());
      setInstagramUser(profile.username);
      toast({ title: `Conta @${profile.username} conectada`, variant: "success" });
    } catch (error) {
      setInstagramUser(null);
      toast({ title: "Token inválido", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function save() {
    if (!base.title.trim()) {
      toast({ title: "Informe um nome.", variant: "error" });
      return;
    }

    const payloadConfig: Record<string, unknown> = { ...config };
    delete payloadConfig.connected;
    delete payloadConfig.tokenUpdatedAt;

    if (type === "instagram") {
      if (instagramToken.trim()) payloadConfig.accessToken = instagramToken.trim();
      if (instagramUser) payloadConfig.username = instagramUser;
      if (!media && !instagramToken.trim()) {
        toast({ title: "Cole o token de acesso do Instagram.", variant: "error" });
        return;
      }
    }

    if (type === "weather") {
      payloadConfig.city = (config.city as string) || null;
      payloadConfig.state = (config.state as string) || null;
    }

    setIsSaving(true);
    try {
      const payload = { ...basePayload(base), config: payloadConfig };
      if (media) await apiClient.updateMedia(media.id, payload);
      else await apiClient.createMedia({ ...payload, type });
      toast({ title: media ? "Atualizado" : "Criado", variant: "success" });
      await onSaved();
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  const preview = (() => {
    switch (type) {
      case "clock":
        return <ClockPreview config={config as unknown as ClockConfig} portrait={portrait} />;
      case "currency":
        return <CurrencyPreview config={config as unknown as CurrencyConfig} portrait={portrait} quotes={quotes} />;
      case "weather":
        return <WeatherPreview config={config as unknown as WeatherConfig} portrait={portrait} weather={weather} />;
      case "rss":
        return <RssPreview config={config as unknown as RssConfig} items={rss} portrait={portrait} />;
      case "notice":
        return <NoticePreview config={config as unknown as NoticeConfig} portrait={portrait} />;
      case "instagram":
        return (
          <InstagramPreview
            background={config.background as string}
            color={config.color as string}
            count={Number(config.postsCount) || 1}
            portrait={portrait}
            posts={[]}
            profileImageUrl={(config.profileImageUrl as string | null) ?? null}
            username={instagramUser}
          />
        );
    }
  })();

  return (
    <Card className="bg-card/70">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{media ? `Editar: ${media.title}` : `Novo — ${meta.title}`}</CardTitle>
        <Tabs
          onChange={setOrientation}
          options={[
            { value: "landscape", label: "Horizontal" },
            { value: "portrait", label: "Vertical" }
          ]}
          value={orientation}
        />
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          {type === "clock" ? <ImageUploadField hint="PNG com fundo transparente, até 600x600." label="Logotipo" onChange={(url) => set("logoUrl", url)} value={(config.logoUrl as string) ?? null} /> : null}

          {type === "currency" ? (
            <Field label="Moedas (até 3)">
              <div className="flex flex-wrap gap-2">
                {["USD", "EUR", "GBP", "ARS", "BTC"].map((code) => {
                  const selected = (config.currencies as string[]).includes(code);
                  return (
                    <button
                      className={`rounded-md border px-3 py-1.5 text-sm ${selected ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground"}`}
                      key={code}
                      onClick={() => {
                        const current = config.currencies as string[];
                        const next = selected ? current.filter((item) => item !== code) : [...current, code].slice(0, 3);
                        set("currencies", next.length ? next : ["USD"]);
                      }}
                      type="button"
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </Field>
          ) : null}

          {type === "weather" ? (
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Field hint="Deixe vazio para usar a cidade de cada terminal." label="Cidade fixa">
                <Input onChange={(event) => set("city", event.target.value)} placeholder="Ex.: Fortaleza" value={(config.city as string) ?? ""} />
              </Field>
              <Field label="UF">
                <Input maxLength={2} onChange={(event) => set("state", event.target.value.toUpperCase())} value={(config.state as string) ?? ""} />
              </Field>
            </div>
          ) : null}

          {type === "rss" ? (
            <>
              <Field hint="Ex.: https://g1.globo.com/dynamo/rss2.xml" label="Link do feed RSS">
                <Input list="rss-sources" onChange={(event) => set("url", event.target.value)} value={(config.url as string) ?? ""} />
                <datalist id="rss-sources">
                  {rssSources.map((source) => (
                    <option key={source.id} value={source.url}>
                      {source.name}
                    </option>
                  ))}
                </datalist>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome da fonte">
                  <Input onChange={(event) => set("source", event.target.value)} placeholder="G1" value={(config.source as string) ?? ""} />
                </Field>
                <Field label="Notícias por exibição">
                  <Select onChange={(event) => set("maxItems", Number(event.target.value))} value={String(config.maxItems ?? 5)}>
                    {[1, 3, 5, 8, 10].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <ImageUploadField aspect="wide" label="Logo da fonte (opcional)" onChange={(url) => set("logoUrl", url)} value={(config.logoUrl as string) ?? null} />
            </>
          ) : null}

          {type === "notice" ? (
            <>
              <Field label="Texto do aviso" required>
                <Textarea maxLength={280} onChange={(event) => set("text", event.target.value)} value={(config.text as string) ?? ""} />
              </Field>
              <Field label="Subtítulo">
                <Input maxLength={200} onChange={(event) => set("subtitle", event.target.value)} value={(config.subtitle as string) ?? ""} />
              </Field>
              <ImageUploadField label="Imagem (opcional)" onChange={(url) => set("imageUrl", url)} value={(config.imageUrl as string) ?? null} />
            </>
          ) : null}

          {type === "instagram" ? (
            <>
              <div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100">
                Funciona com contas <b>comerciais ou de criador</b>. Gere um token de longa duração na API do Instagram (Meta for Developers →
                Instagram → “Gerar token”) e cole abaixo. O token é renovado automaticamente.
                <a className="ml-1 inline-flex items-center gap-1 underline" href="https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login" rel="noreferrer" target="_blank">
                  Ver instruções <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Field label={media ? "Novo token (deixe vazio para manter o atual)" : "Token de acesso"} required={!media}>
                <div className="flex gap-2">
                  <Input onChange={(event) => setInstagramToken(event.target.value)} placeholder="IGAA..." type="password" value={instagramToken} />
                  <Button disabled={instagramToken.trim().length < 20} onClick={() => void verifyInstagram()} type="button" variant="secondary">
                    Verificar
                  </Button>
                </div>
              </Field>
              {instagramUser ? (
                <p className="flex items-center gap-1 text-sm text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> Conectado como @{instagramUser}
                </p>
              ) : media && (media.config as InstagramConfig | null)?.connected ? (
                <Badge tone="success">Token salvo</Badge>
              ) : null}
              <Field label="Postagens por exibição">
                <Select onChange={(event) => set("postsCount", Number(event.target.value))} value={String(config.postsCount ?? 1)}>
                  <option value="1">1 postagem</option>
                  <option value="3">3 postagens</option>
                </Select>
              </Field>
              <ImageUploadField label="Foto do perfil" onChange={(url) => set("profileImageUrl", url)} value={(config.profileImageUrl as string) ?? null} />
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Cor de fundo" onChange={(value) => set("background", value)} value={(config.background as string) ?? "#111827"} />
            <ColorField label="Cor da fonte" onChange={(value) => set("color", value)} value={(config.color as string) ?? "#ffffff"} />
          </div>

          <BaseMediaFields companies={companies} onChange={setBase} screens={screens} value={base} />

          <div className="flex justify-end gap-2">
            <Button onClick={onCancel} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={isSaving} onClick={() => void save()} type="button">
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
        <div className="grid content-start gap-2 lg:sticky lg:top-24">
          <p className="text-sm font-medium text-muted-foreground">Prévia ao vivo</p>
          {preview}
        </div>
      </CardContent>
    </Card>
  );
}
