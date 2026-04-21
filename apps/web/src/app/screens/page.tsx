"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ScreenDetailDto, ScreenDto } from "@dialindooh/shared";
import { MonitorUp, Tv } from "lucide-react";
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
      await apiClient.createScreen({ name, slug: slug || undefined, location: location || null });
      toast({ title: "Screen created", description: name, variant: "success" });
      setName("");
      setSlug("");
      setLocation("");
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

  async function updateScreen(input: { name?: string; slug?: string; location?: string | null }) {
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
                  <DetailLine label="Activation code" value={detail.activationCode} mono />
                  <DetailLine label="Last seen" value={formatDate(detail.lastSeenAt)} />
                  <DetailLine label="Last heartbeat" value={formatDate(detail.lastHeartbeat?.sentAt)} />
                  <DetailLine label="App version" value={detail.lastHeartbeat?.appVersion ?? "Unknown"} />
                  <DetailLine label="IP address" value={detail.lastHeartbeat?.ipAddress ?? "Unknown"} />
                  <DetailLine label="Current media" value={detail.lastHeartbeat?.currentMedia?.title ?? "None"} />
                </div>
                <EditScreenForm detail={detail} key={detail.id} onSave={updateScreen} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppShell>
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
  onSave: (input: { name: string; slug: string; location: string | null }) => void;
}) {
  const [name, setName] = useState(detail.name);
  const [slug, setSlug] = useState(detail.slug);
  const [location, setLocation] = useState(detail.location ?? "");

  return (
    <form
      className="space-y-4 rounded-lg border bg-background/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name, slug, location: location || null });
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
      <Button type="submit">Save screen</Button>
    </form>
  );
}
