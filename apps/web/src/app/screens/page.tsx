"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  ScreenCommandStatus,
  ScreenCommandType,
  ScreenDetailDto,
  ScreenDto,
  ScreenEventLevel,
  ScreenOrientation
} from "@dialindooh/shared";
import { MonitorUp, RotateCcw, Settings, Trash2, Tv, Wifi } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { ScreenCard } from "@/components/admin/screen-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

const SCREEN_STATUS_REFRESH_MS = 30 * 1000;

export default function ScreensPage() {
  const { toast } = useToast();
  const screensQuery = useApiQuery(apiClient.listScreens, []);
  const playlistsQuery = useApiQuery(apiClient.listPlaylists, []);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [location, setLocation] = useState("");
  const [orientation, setOrientation] = useState<ScreenOrientation>("landscape");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<ScreenDto | null>(null);
  const [detail, setDetail] = useState<ScreenDetailDto | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScreenDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const screens = screensQuery.data ?? [];
  const playlists = playlistsQuery.data ?? [];

  useEffect(() => {
    const interval = setInterval(() => void screensQuery.refresh({ silent: true }), SCREEN_STATUS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [screensQuery.refresh]);

  useEffect(() => {
    if (!selectedScreen) {
      setDetail(null);
      return;
    }

    let active = true;
    const loadDetail = (silent = false) => {
      if (!silent) {
        setDetail(null);
      }
      setDetailError(null);
      return apiClient
        .getScreen(selectedScreen.id)
        .then((screen) => {
          if (active) {
            setDetail(screen);
          }
        })
        .catch((error) => {
          if (active) {
            setDetailError(getApiErrorMessage(error));
          }
        });
    };

    void loadDetail();
    const interval = setInterval(() => void loadDetail(true), SCREEN_STATUS_REFRESH_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedScreen]);

  async function createScreen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);

    try {
      await apiClient.createScreen({ name, slug: slug || undefined, location: location || null, orientation });
      toast({ title: "Tela criada", description: name, variant: "success" });
      setName("");
      setSlug("");
      setLocation("");
      setOrientation("landscape");
      await screensQuery.refresh();
    } catch (error) {
      toast({ title: "Falha ao criar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  async function assignPlaylist(screenId: string, playlistId: string) {
    try {
      await apiClient.updateScreen(screenId, { playlistId: playlistId || null });
      toast({ title: "Playlist atribuída", variant: "success" });
      await screensQuery.refresh();
    } catch (error) {
      toast({ title: "Falha ao atribuir playlist", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function updateScreen(input: { name?: string; slug?: string; location?: string | null; orientation?: ScreenOrientation }) {
    if (!selectedScreen) {
      return;
    }

    try {
      await apiClient.updateScreen(selectedScreen.id, input);
      toast({ title: "Tela atualizada", variant: "success" });
      await screensQuery.refresh();
      setDetail(await apiClient.getScreen(selectedScreen.id));
    } catch (error) {
      toast({ title: "Falha ao atualizar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function sendCommand(type: ScreenCommandType) {
    if (!selectedScreen) {
      return;
    }

    try {
      await apiClient.createScreenCommand(selectedScreen.id, type);
      toast({ title: "Comando enviado", description: commandLabels[type], variant: "success" });
      setDetail(await apiClient.getScreen(selectedScreen.id));
    } catch (error) {
      toast({ title: "Falha no comando", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function confirmDeleteScreen() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      await apiClient.deleteScreen(deleteTarget.id);
      toast({ title: "Tela apagada", description: deleteTarget.name, variant: "success" });
      if (selectedScreen?.id === deleteTarget.id) {
        setSelectedScreen(null);
        setDetail(null);
      }
      setDeleteTarget(null);
      await screensQuery.refresh();
    } catch (error) {
      toast({ title: "Falha ao apagar tela", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Card className="h-fit bg-card/70">
          <CardHeader>
            <CardTitle>Criar tela</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createScreen}>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Tela da recepção"
                required
                value={name}
              />
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setSlug(event.currentTarget.value)}
                placeholder="tela-recepcao"
                value={slug}
              />
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setLocation(event.currentTarget.value)}
                placeholder="Local"
                value={location}
              />
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setOrientation(event.currentTarget.value as ScreenOrientation)}
                value={orientation}
              >
                <option value="landscape">Tela horizontal</option>
                <option value="portrait">Tela vertical</option>
              </select>
              <Button className="w-full" disabled={isCreating} type="submit">
                <MonitorUp className="h-4 w-4" aria-hidden="true" />
                {isCreating ? "Criando..." : "Criar tela"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {screensQuery.error || playlistsQuery.error ? (
          <ErrorBanner message={screensQuery.error ?? playlistsQuery.error ?? "Não foi possível carregar as telas."} />
        ) : screensQuery.isLoading || playlistsQuery.isLoading ? (
          <LoadingSkeleton className="h-96" />
        ) : screens.length === 0 ? (
          <EmptyState icon={Tv} title="Nenhuma tela cadastrada" description="Crie uma tela para gerar um código de ativação." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {screens.map((screen) => (
              <ScreenCard
                key={screen.id}
                onAssign={assignPlaylist}
                onDelete={setDeleteTarget}
                onSelect={setSelectedScreen}
                playlists={playlists}
                screen={screen}
              />
            ))}
          </div>
        )}
      </div>

      {selectedScreen ? (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l bg-card p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{selectedScreen.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedScreen.slug}</p>
              </div>
              <Button onClick={() => setSelectedScreen(null)} type="button" variant="ghost">
                Fechar
              </Button>
            </div>

            {detailError ? <p className="mt-4 rounded-md border border-destructive/40 p-3 text-sm">{detailError}</p> : null}
            {!detail && !detailError ? <LoadingSkeleton className="mt-6 h-96" /> : null}
            {detail ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 rounded-lg border bg-background/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge status={detail.status} />
                  </div>
                  <DetailLine label="Playlist atribuída" value={detail.activeAssignment?.playlist.name ?? "Nenhuma"} />
                  <DetailLine label="Orientação" value={screenOrientationLabels[detail.orientation]} />
                  <DetailLine label="Código de ativação" value={detail.activationCode} mono />
                  <DetailLine label="Última atividade" value={formatDate(detail.lastSeenAt)} />
                  <DetailLine label="Último sinal" value={formatDate(detail.lastHeartbeat?.sentAt)} />
                  <DetailLine label="Versão do aplicativo" value={detail.lastHeartbeat?.appVersion ?? "Desconhecida"} />
                  <DetailLine label="Endereço IP" value={detail.lastHeartbeat?.ipAddress ?? "Desconhecido"} />
                  <DetailLine label="Mídia atual" value={detail.lastHeartbeat?.currentMedia?.title ?? "Nenhuma"} />
                </div>
                <RemoteCommands onCommand={sendCommand} />
                <RecentCommands detail={detail} />
                <RecentEvents detail={detail} />
                <EditScreenForm detail={detail} key={detail.id} onSave={updateScreen} />
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <h3 className="font-semibold">Apagar tela</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Remove esta tela, o histórico de sinais, eventos, comandos e vínculos com playlists.
                  </p>
                  <Button className="mt-4" onClick={() => setDeleteTarget(detail)} type="button" variant="destructive">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Apagar tela
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Apagar tela?"
        description={
          deleteTarget
            ? `A tela "${deleteTarget.name}" será removida junto com seu histórico de sinais, eventos e comandos.`
            : "Essa ação não pode ser desfeita."
        }
        confirmLabel="Apagar"
        isLoading={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteScreen}
      />
    </AppShell>
  );
}

const commandLabels: Record<ScreenCommandType, string> = {
  refresh_playlist: "Atualizar playlist",
  clear_cache: "Limpar cache",
  restart_player: "Reiniciar reprodutor",
  reload_app: "Recarregar aplicativo",
  open_overlay_settings: "Abrir permissão de sobreposição"
};

const commandStatusLabels: Record<ScreenCommandStatus, string> = {
  pending: "Pendente",
  delivered: "Entregue",
  acknowledged: "Confirmado",
  failed: "Falhou"
};

const screenEventLevelLabels: Record<ScreenEventLevel, string> = {
  info: "Info",
  warn: "Aviso",
  error: "Erro"
};

const screenEventTypeLabels: Record<string, string> = {
  playlist_synced: "Playlist sincronizada",
  playlist_sync_failed: "Falha ao sincronizar playlist",
  player_restarted: "Reprodutor reiniciado",
  playback_error: "Erro de reprodução"
};

const screenOrientationLabels: Record<ScreenOrientation, string> = {
  landscape: "Horizontal",
  portrait: "Vertical"
};

function RemoteCommands({ onCommand }: { onCommand: (type: ScreenCommandType) => void }) {
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <h3 className="font-semibold">Comandos remotos</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button onClick={() => onCommand("refresh_playlist")} type="button" variant="secondary">
          <Wifi className="h-4 w-4" aria-hidden="true" />
          Atualizar agora
        </Button>
        <Button onClick={() => onCommand("clear_cache")} type="button" variant="secondary">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Limpar cache
        </Button>
        <Button onClick={() => onCommand("restart_player")} type="button" variant="secondary">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reiniciar reprodutor
        </Button>
        <Button onClick={() => onCommand("reload_app")} type="button" variant="secondary">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Recarregar aplicativo
        </Button>
        <Button onClick={() => onCommand("open_overlay_settings")} type="button" variant="secondary">
          <Settings className="h-4 w-4" aria-hidden="true" />
          Permitir sobrepor
        </Button>
      </div>
    </div>
  );
}

function RecentCommands({ detail }: { detail: ScreenDetailDto }) {
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <h3 className="font-semibold">Últimos comandos</h3>
      <div className="mt-3 grid gap-2">
        {detail.recentCommands.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comando enviado.</p>
        ) : (
          detail.recentCommands.map((command) => (
            <div className="rounded-md border bg-card/50 p-3 text-sm" key={command.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{commandLabels[command.type]}</span>
                <span className="rounded-full border px-2 py-0.5 text-xs">{commandStatusLabels[command.status]}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(command.requestedAt)}</p>
              {command.errorMessage ? <p className="mt-1 text-xs text-destructive">{command.errorMessage}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentEvents({ detail }: { detail: ScreenDetailDto }) {
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <h3 className="font-semibold">Eventos da TV</h3>
      <div className="mt-3 grid gap-2">
        {detail.recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento recebido.</p>
        ) : (
          detail.recentEvents.map((event) => (
            <div className="rounded-md border bg-card/50 p-3 text-sm" key={event.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{screenEventTypeLabels[event.type] ?? event.type}</span>
                <span className="rounded-full border px-2 py-0.5 text-xs">{screenEventLevelLabels[event.level]}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{event.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DetailLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function EditScreenForm({
  detail,
  onSave
}: {
  detail: ScreenDetailDto;
  onSave: (input: { name: string; slug: string; location: string | null; orientation: ScreenOrientation }) => void;
}) {
  const [name, setName] = useState(detail.name);
  const [slug, setSlug] = useState(detail.slug);
  const [location, setLocation] = useState(detail.location ?? "");
  const [orientation, setOrientation] = useState<ScreenOrientation>(detail.orientation);

  return (
    <form
      className="space-y-4 rounded-lg border bg-background/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name, slug, location: location || null, orientation });
      }}
    >
      <h3 className="font-semibold">Editar tela</h3>
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setName(event.currentTarget.value)}
        value={name}
      />
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setSlug(event.currentTarget.value)}
        value={slug}
      />
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setLocation(event.currentTarget.value)}
        value={location}
      />
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setOrientation(event.currentTarget.value as ScreenOrientation)}
        value={orientation}
      >
        <option value="landscape">Tela horizontal</option>
        <option value="portrait">Tela vertical</option>
      </select>
      <Button type="submit">Salvar tela</Button>
    </form>
  );
}
