"use client";

import { useEffect } from "react";
import { Image, ListVideo, MonitorPlay, RadioTower, WifiOff } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { ErrorBanner } from "@/components/admin/error-banner";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { formatBytes, formatDate } from "@/lib/format";

const SCREEN_STATUS_REFRESH_MS = 30 * 1000;

export default function DashboardPage() {
  const mediaQuery = useApiQuery(apiClient.listMedia, []);
  const playlistsQuery = useApiQuery(apiClient.listPlaylists, []);
  const screensQuery = useApiQuery(apiClient.listScreens, []);
  const isLoading = mediaQuery.isLoading || playlistsQuery.isLoading || screensQuery.isLoading;
  const media = mediaQuery.data ?? [];
  const playlists = playlistsQuery.data ?? [];
  const screens = screensQuery.data ?? [];
  const onlineScreens = screens.filter((screen) => screen.status === "online");
  const offlineScreens = screens.filter((screen) => screen.status === "offline");
  const recentScreens = [...screens].sort(compareDates((screen) => screen.lastSeenAt)).slice(0, 5);
  const latestMedia = [...media].sort(compareDates((item) => item.createdAt)).slice(0, 5);
  const heartbeatActivity = [...screens]
    .filter((screen) => screen.lastHeartbeatAt)
    .sort(compareDates((screen) => screen.lastHeartbeatAt))
    .slice(0, 5);
  const error = mediaQuery.error ?? playlistsQuery.error ?? screensQuery.error;

  useEffect(() => {
    const interval = setInterval(() => void screensQuery.refresh({ silent: true }), SCREEN_STATUS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [screensQuery.refresh]);

  return (
    <AppShell>
      {error ? <ErrorBanner message={error} /> : null}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Mídias" value={media.length} icon={Image} caption="Imagens e vídeos na biblioteca" />
            <StatCard label="Playlists" value={playlists.length} icon={ListVideo} caption="Sequências de reprodução configuradas" />
            <StatCard label="Telas" value={screens.length} icon={MonitorPlay} caption="Dispositivos cadastrados" />
            <StatCard label="Online" value={onlineScreens.length} icon={RadioTower} caption="Reportando atividade agora" />
            <StatCard label="Offline" value={offlineScreens.length} icon={WifiOff} caption="Sem sinal recente ou em atenção" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="bg-card/70 xl:col-span-1">
              <CardHeader>
                <CardTitle>Telas recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentScreens.map((screen) => (
                  <div className="flex items-center justify-between gap-3" key={screen.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{screen.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(screen.lastSeenAt)}</p>
                    </div>
                    <StatusBadge status={screen.status} />
                  </div>
                ))}
                {recentScreens.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma tela cadastrada.</p> : null}
              </CardContent>
            </Card>

            <Card className="bg-card/70 xl:col-span-1">
              <CardHeader>
                <CardTitle>Últimas mídias enviadas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestMedia.map((item) => (
                  <div className="flex items-center justify-between gap-3" key={item.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {mediaTypeLabels[item.type]} · {formatBytes(item.sizeBytes)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                  </div>
                ))}
                {latestMedia.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma mídia enviada.</p> : null}
              </CardContent>
            </Card>

            <Card className="bg-card/70 xl:col-span-1">
              <CardHeader>
                <CardTitle>Últimos sinais das TVs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {heartbeatActivity.map((screen) => (
                  <div className="flex items-center justify-between gap-3" key={screen.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{screen.name}</p>
                      <p className="text-xs text-muted-foreground">{screen.slug}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(screen.lastHeartbeatAt)}</p>
                  </div>
                ))}
                {heartbeatActivity.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum sinal recebido ainda.</p> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

const mediaTypeLabels = {
  image: "Imagem",
  video: "Vídeo"
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <LoadingSkeleton className="h-36" key={index} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <LoadingSkeleton className="h-80" key={index} />
        ))}
      </div>
    </div>
  );
}

function compareDates<T>(getValue: (item: T) => string | null | undefined) {
  return (left: T, right: T) => {
    const leftTime = new Date(getValue(left) ?? 0).getTime();
    const rightTime = new Date(getValue(right) ?? 0).getTime();
    return rightTime - leftTime;
  };
}
