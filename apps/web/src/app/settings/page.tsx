"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Download, Tv } from "lucide-react";
import { DEFAULT_FOOTER, type FooterConfig, type WeatherData } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "@/components/layout/session-context";
import { ImageUploadField } from "@/components/admin/pickers";
import { StrengthBar } from "@/components/admin/password-strength";
import { TIMEZONES } from "@/components/screens/screen-form";
import { FooterPreview } from "@/components/widgets/widget-preview";
import { useToast } from "@/components/feedback/toast";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorField, Field, Input, Select, Switch, Tabs } from "@/components/ui/form";
import { apiClient, getApiErrorMessage, type AccountSettingsDto } from "@/lib/api-client";

type Tab = "footer" | "branding" | "tv" | "profile";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const { session, refresh } = useSession();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) || (session?.isAdmin === false ? "profile" : "footer"));
  const [account, setAccount] = useState<AccountSettingsDto | null>(null);
  const [footer, setFooter] = useState<FooterConfig>(DEFAULT_FOOTER);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [profile, setProfile] = useState({ name: "", avatarUrl: null as string | null, timezone: "America/Sao_Paulo", currentPassword: "", newPassword: "" });

  useEffect(() => {
    apiClient
      .getAccount()
      .then((data) => {
        setAccount(data);
        setFooter(data.footer);
      })
      .catch(() => undefined);
    apiClient.previewWidget({ type: "weather", city: "São Paulo", state: "SP" }).then((data) => setWeather(data.weather ?? null)).catch(() => undefined);
  }, [session?.account.id]);

  useEffect(() => {
    if (session) setProfile((current) => ({ ...current, name: session.user.name, avatarUrl: session.user.avatarUrl, timezone: session.user.timezone ?? "America/Sao_Paulo" }));
  }, [session]);

  async function saveAccount(input: Parameters<typeof apiClient.updateAccount>[0], message = "Configurações salvas") {
    try {
      await apiClient.updateAccount(input);
      await refresh();
      toast({ title: message, variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function saveProfile() {
    try {
      await apiClient.updateProfile({
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        timezone: profile.timezone,
        ...(profile.newPassword ? { currentPassword: profile.currentPassword, newPassword: profile.newPassword } : {})
      });
      setProfile((current) => ({ ...current, currentPassword: "", newPassword: "" }));
      await refresh();
      toast({ title: "Perfil atualizado", variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const setF = <K extends keyof FooterConfig>(key: K, value: FooterConfig[K]) => setFooter((current) => ({ ...current, [key]: value }));
  const tabs: Array<{ value: Tab; label: string }> = session?.isAdmin
    ? [
        { value: "footer", label: "Barra de rodapé" },
        { value: "branding", label: "Marca e telas" },
        { value: "tv", label: "Aplicativo da TV" },
        { value: "profile", label: "Meu perfil" }
      ]
    : [{ value: "profile", label: "Meu perfil" }];

  return (
    <AppShell description="Personalize a conta, o rodapé das TVs e o seu perfil." title="Configurações">
      <div className="mb-5">
        <Tabs onChange={setTab} options={tabs} value={tab} />
      </div>

      {tab === "footer" && account ? (
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Barra de rodapé</CardTitle>
            <p className="text-sm text-muted-foreground">Aparece nos terminais com “Barra de rodapé” ligada no cadastro.</p>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="grid content-start gap-4">
              <ImageUploadField aspect="wide" hint="PNG transparente, 300x150, até 400 KB." label="Logotipo" onChange={(url) => setF("logoUrl", url)} value={footer.logoUrl} />
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Cor de fundo" onChange={(value) => setF("background", value)} value={footer.background} />
                <ColorField label="Cor da fonte" onChange={(value) => setF("color", value)} value={footer.color} />
              </div>
              <Field hint={`${footer.phrase.length}/300`} label="Frase padrão">
                <Input maxLength={300} onChange={(event) => setF("phrase", event.target.value)} value={footer.phrase} />
              </Field>
              <Field hint="Opcional: manchetes rolando no rodapé em vez da frase." label="Feed RSS no rodapé">
                <Input onChange={(event) => setF("rssUrl", event.target.value || null)} placeholder="https://g1.globo.com/dynamo/rss2.xml" value={footer.rssUrl ?? ""} />
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Switch checked={footer.showPhrase} label="Frase" onChange={(value) => setF("showPhrase", value)} />
                <Switch checked={footer.showDate} label="Data" onChange={(value) => setF("showDate", value)} />
                <Switch checked={footer.showTime} label="Hora" onChange={(value) => setF("showTime", value)} />
                <Switch checked={footer.showWeather} label="Clima" onChange={(value) => setF("showWeather", value)} />
                <Switch checked={footer.showIcons} label="Ícones" onChange={(value) => setF("showIcons", value)} />
              </div>
              <Field label="Velocidade da frase">
                <Select onChange={(event) => setF("speed", event.target.value as FooterConfig["speed"])} value={footer.speed}>
                  <option value="slow">Lenta</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Rápida</option>
                </Select>
              </Field>
              <div>
                <Button onClick={() => void saveAccount({ footer: { ...footer, rssUrl: footer.rssUrl || null } }, "Rodapé salvo")} type="button">
                  Salvar rodapé
                </Button>
              </div>
            </div>
            <div className="grid content-start gap-2">
              <p className="text-sm text-muted-foreground">Prévia (clima de exemplo; na TV usa a cidade do terminal)</p>
              <FooterPreview config={footer} weather={weather} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "branding" && account ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="bg-card/70">
            <CardHeader>
              <CardTitle className="text-base">Identidade da conta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Nome da conta">
                <Input onChange={(event) => setAccount({ ...account, name: event.target.value })} value={account.name} />
              </Field>
              <ImageUploadField aspect="wide" hint="Aparece no menu do painel." label="Logotipo do painel" onChange={(url) => setAccount({ ...account, logoUrl: url })} value={account.logoUrl} />
              {session?.isSuperadmin ? (
                <ImageUploadField
                  aspect="wide"
                  hint="Imagem da tela de login do painel (800x800 ou maior)."
                  label="Imagem da tela de login"
                  onChange={(url) => setAccount({ ...account, loginImageUrl: url })}
                  value={account.loginImageUrl}
                />
              ) : null}
              <div>
                <Button onClick={() => void saveAccount({ name: account.name, logoUrl: account.logoUrl, loginImageUrl: account.loginImageUrl })} type="button">
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/70">
            <CardHeader>
              <CardTitle className="text-base">Tela de abertura da TV</CardTitle>
              <p className="text-sm text-muted-foreground">Imagem exibida enquanto o app da TV inicia e carrega a programação.</p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ImageUploadField hint="800x800, fundo transparente." label="Imagem de inicialização" onChange={(url) => setAccount({ ...account, splashUrl: url })} value={account.splashUrl} />
              <Switch checked={account.splashEnabled} label="Ativar imagem personalizada" onChange={(value) => setAccount({ ...account, splashEnabled: value })} />
              <div>
                <Button onClick={() => void saveAccount({ splashUrl: account.splashUrl, splashEnabled: account.splashEnabled })} type="button">
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "tv" && account ? (
        <Card className="bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tv className="h-5 w-5 text-primary" /> Instalar o app nas TVs
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <ol className="grid list-decimal gap-2 pl-5 text-sm">
              <li>Na TV box, instale o app <b>Downloader</b> (Play Store / Aptoide).</li>
              <li>
                Abra o Downloader e digite o endereço:{" "}
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono">
                  {origin}/apk
                  <button aria-label="Copiar" onClick={() => void navigator.clipboard.writeText(`${origin}/apk`)} type="button">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
              <li>Permita instalar apps de fontes desconhecidas quando o Android pedir e instale.</li>
              <li>
                Abra o app e libere <b>Sobrepor outros apps</b> (Configurações → Apps → Acesso especial → Exibir sobre outros apps). Isso faz o app abrir sozinho
                quando a TV liga.
              </li>
              <li>Digite o código de ativação mostrado no cadastro do terminal.</li>
            </ol>
            {session?.isSuperadmin ? (
              <div className="grid content-start gap-3">
                <Field hint="Link direto do arquivo .apk (ex.: link do build no Expo). O endereço /apk redireciona para cá." label="Link do APK">
                  <Input onChange={(event) => setAccount({ ...account, apkUrl: event.target.value || null })} value={account.apkUrl ?? ""} />
                </Field>
                <Field
                  hint="Número da versão (versionCode) desse APK, ex.: 22. TVs com versão menor baixam e instalam sozinhas às 04:00, ou na hora pelo botão Atualizar app (APK) do terminal."
                  label="Versão do APK (versionCode)"
                >
                  <Input
                    inputMode="numeric"
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      setAccount({ ...account, apkVersionCode: Number.isFinite(value) && value > 0 ? value : null });
                    }}
                    value={account.apkVersionCode ?? ""}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button onClick={() => void saveAccount({ apkUrl: account.apkUrl, apkVersionCode: account.apkVersionCode })} type="button">
                    Publicar versão
                  </Button>
                  <a className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm hover:bg-muted" href="/apk">
                    <Download className="h-4 w-4" /> Testar download
                  </a>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === "profile" ? (
        <Card className="max-w-2xl bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Meu perfil</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5 text-sm">
              <span className="font-medium">Aparência do painel</span>
              <ThemeToggle className="w-fit" />
              <span className="text-xs text-muted-foreground">Automático segue o tema do seu computador ou celular. Não muda nada nas TVs.</span>
            </div>
            <ImageUploadField label="Foto" onChange={(url) => setProfile({ ...profile, avatarUrl: url })} value={profile.avatarUrl} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome">
                <Input onChange={(event) => setProfile({ ...profile, name: event.target.value })} value={profile.name} />
              </Field>
              <Field label="Fuso horário">
                <Select onChange={(event) => setProfile({ ...profile, timezone: event.target.value })} value={profile.timezone}>
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace("America/", "").replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Senha atual">
                <Input autoComplete="current-password" onChange={(event) => setProfile({ ...profile, currentPassword: event.target.value })} type="password" value={profile.currentPassword} />
              </Field>
              <Field label="Nova senha">
                <Input autoComplete="new-password" onChange={(event) => setProfile({ ...profile, newPassword: event.target.value })} type="password" value={profile.newPassword} />
                <StrengthBar password={profile.newPassword} />
              </Field>
            </div>
            <div>
              <Button onClick={() => void saveProfile()} type="button">
                Salvar perfil
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}
