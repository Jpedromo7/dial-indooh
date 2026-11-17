"use client";

import Link from "next/link";
import { Activity, FolderKanban, ListVideo, PlayCircle, Star, Tv } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { BarChart, Gauge, monthLabel, Sparkline } from "@/components/admin/charts";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";

export default function DashboardPage() {
  const dashboard = useApiQuery(apiClient.getDashboard, []);
  const data = dashboard.data;
  const onlinePct = data && data.screens.total ? (data.screens.online / data.screens.total) * 100 : 0;
  const variation =
    data && data.playsLastMonth ? Math.round(((data.playsThisMonth - data.playsLastMonth) / data.playsLastMonth) * 100) : null;

  return (
    <AppShell description="Visão geral dos seus terminais e exibições." title="Início">
      {dashboard.error ? <ErrorBanner message={dashboard.error} /> : null}
      {dashboard.isLoading && !data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <LoadingSkeleton className="h-48" />
          <LoadingSkeleton className="h-48" />
          <LoadingSkeleton className="h-48" />
        </div>
      ) : null}
      {data ? (
        <div className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card/70">
              <CardHeader>
                <CardTitle className="text-base">Terminais online</CardTitle>
              </CardHeader>
              <CardContent>
                <Gauge label={`${data.screens.online} de ${data.screens.total} terminais online`} percent={onlinePct} />
              </CardContent>
            </Card>
            <Card className="bg-card/70">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Exibições no mês</CardTitle>
                  {variation !== null ? <Badge tone={variation >= 0 ? "success" : "danger"}>{variation >= 0 ? "+" : ""}{variation}%</Badge> : null}
                </div>
                <p className="text-3xl font-semibold">{data.playsThisMonth.toLocaleString("pt-BR")}</p>
              </CardHeader>
              <CardContent>
                <BarChart data={data.monthlyPlays.map((row) => ({ label: row.month, value: row.plays }))} formatLabel={monthLabel} height={90} />
              </CardContent>
            </Card>
            <Card className="bg-card/70">
              <CardHeader>
                <CardTitle className="text-base">Saúde dos terminais</CardTitle>
                <p className="text-xs text-muted-foreground">% de terminais que se comunicaram por dia (últimos 7 dias)</p>
              </CardHeader>
              <CardContent>
                <Sparkline values={data.health.map((row) => row.onlinePct)} />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{data.health[0]?.date.slice(8, 10)}/{data.health[0]?.date.slice(5, 7)}</span>
                  <span>Hoje: {data.health.at(-1)?.onlinePct ?? 0}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Tv} label="Terminais" value={data.screens.total} caption={`${data.screens.offline} offline`} />
            <StatCard icon={ListVideo} label="Mídias" value={data.mediaCount} />
            <StatCard icon={FolderKanban} label="Grupos" value={data.playlistCount} />
            <StatCard icon={PlayCircle} label="Exibições no mês passado" value={data.playsLastMonth.toLocaleString("pt-BR")} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-card/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" /> Melhores terminais (30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data.topScreens.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há exibições registradas.</p> : null}
                {data.topScreens.map((screen, index) => (
                  <Link className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40" href={`/screens/${screen.id}`} key={screen.id}>
                    <span className="w-5 text-sm text-muted-foreground">{index + 1}</span>
                    <span className="flex-1 truncate text-sm">{screen.name}</span>
                    <span className="text-sm font-semibold">{screen.plays.toLocaleString("pt-BR")}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
            <Card className="bg-card/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-4 w-4 text-amber-500" /> Terminais favoritos
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data.favorites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Marque terminais com a estrela para acompanhar aqui.</p>
                ) : null}
                {data.favorites.map((screen) => (
                  <Link className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40" href={`/screens/${screen.id}`} key={screen.id}>
                    <span className="flex-1 truncate text-sm">{screen.name}</span>
                    <StatusBadge status={screen.status} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {data.notifications.length ? (
            <Card className="bg-card/70">
              <CardHeader>
                <CardTitle className="text-base">Avisos</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {data.notifications.slice(0, 8).map((notification) => (
                  <Link className="rounded-md border px-3 py-2 hover:bg-muted/40" href={notification.href ?? "#"} key={notification.id}>
                    <p className={notification.level === "error" ? "text-sm font-medium text-red-700 dark:text-red-300" : "text-sm font-medium text-amber-700 dark:text-amber-300"}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
