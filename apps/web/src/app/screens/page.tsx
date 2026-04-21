"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ScreenCommandType, ScreenDetailDto, ScreenDto, ScreenOrientation } from "@dialindooh/shared";
import { MonitorUp, RotateCcw, Trash2, Tv, Wifi } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
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
  const screens = screensQuery.data ?? [];
  const playlists = playlistsQuery.data ?? [];

  useEffect(() => {
    if (!selectedScreen) {
      setDetail(null);
      return;
    }

    let active = true;
    setDetail(null);
    setDetailError(null);
    apiClient
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

    return () => {
      active = false;
    };
  }, [selectedScreen]);

  async function createScreen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);

    try {
      await apiClient.createScreen({ name, slug: slug || undefined, location: location || null, orientation });
      toast({ title: "Screen created", description: name, variant: "success" });
      setName("");
      setSlug("");
      setLocation("");
      setOrientation("landscape");
      await screensQuery.refresh();
    } catch (error) {
      toast({ title: "Create failed", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  async function assignPlaylist(screenId: string, playlistId: string) {
    try {
      await apiClient.updateScreen(screenId, { playlistId: playlistId || null });
      toast({ title: "Assignment updated", variant: "success" });
      await screensQuery.refresh();
    } catch (error) {
      toast({ title: "Assignment failed", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function updateScreen(input: { name?: string; slug?: string; location?: string | null; orientation?: ScreenOrientation }) {
    if (!selectedScreen) {
      return;
    }

    try {
      await apiClient.updateScreen(selectedScreen.id, input);
      toast({ title: "Screen updated", variant: "success" });
      await screensQuery.refresh();
      setDetail(await apiClient.getScreen(selectedScreen.id));
    } catch (error) {
      toast({ title: "Update failed", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function sendCommand(type: ScreenCommandType) {
    if (!selectedScreen) {
      return;
    }

    try {
      await apiClient.createScreenCommand(selectedScreen.id, type);
      toast({ title: "Command queued", description: commandLabels[type], variant: "success" });
      setDetail(await apiClient.getScreen(selectedScreen.id));
    } catch (error) {
      toast({ title: "Command failed", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Card className="h-fit bg-card/70">
          <CardHeader>
            <CardTitle>Create screen</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createScreen}>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Lobby screen"
                required
                value={name}
              />
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setSlug(event.currentTarget.value)}
                placeholder="lobby-screen"
                value={slug}
              />
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setLocation(event.currentTarget.value)}
                placeholder="Location"
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
                {isCreating ? "Creating..." : "Create screen"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {screensQuery.error || playlistsQuery.error ? (
          <ErrorBanner message={screensQuery.error ?? playlistsQuery.error ?? "Unable to load screens."} />
        ) : screensQuery.isLoading || playlistsQuery.isLoading ? (
          <LoadingSkeleton className="h-96" />
        ) : screens.length === 0 ? (
          <EmptyState icon={Tv} title="No screens registered" description="Create a screen to get an activation code." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {screens.map((screen) => (
              <ScreenCard
                key={screen.id}
                onAssign={assignPlaylist}
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
                Close
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
                  <DetailLine label="Assigned playlist" value={detail.activeAssignment?.playlist.name ?? "None"} />
                  <DetailLine label="Orientation" value={screenOrientationLabels[detail.orientation]} />
                  <DetailLine label="Activation code" value={detail.activationCode} mono />
                  <DetailLine label="Last seen" value={formatDate(detail.lastSeenAt)} />
                  <DetailLine label="Last heartbeat" value={formatDate(detail.lastHeartbeat?.sentAt)} />
                  <DetailLine label="App version" value={detail.lastHeartbeat?.appVersion ?? "Unknown"} />
                  <DetailLine label="IP address" value={detail.lastHeartbeat?.ipAddress ?? "Unknown"} />
                  <DetailLine label="Current media" value={detail.lastHeartbeat?.currentMedia?.title ?? "None"} />
                </div>
                <RemoteCommands onCommand={sendCommand} />
                <RecentCommands detail={detail} />
                <RecentEvents detail={detail} />
                <EditScreenForm detail={detail} key={detail.id} onSave={updateScreen} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

const commandLabels: Record<ScreenCommandType, string> = {
  refresh_playlist: "Atualizar playlist",
  clear_cache: "Limpar cache",
  restart_player: "Reiniciar player",
  reload_app: "Recarregar app"
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
          Reiniciar player
        </Button>
        <Button onClick={() => onCommand("reload_app")} type="button" variant="secondary">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Recarregar app
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
                <span className="rounded-full border px-2 py-0.5 text-xs">{command.status}</span>
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
                <span className="font-medium">{event.type}</span>
                <span className="rounded-full border px-2 py-0.5 text-xs">{event.level}</span>
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
      <h3 className="font-semibold">Edit screen</h3>
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
      <Button type="submit">Save screen</Button>
    </form>
  );
}
