"use client";

import { useState } from "react";
import { CalendarDays, Clock3, FileSpreadsheet, FileText, PlayCircle, Tv } from "lucide-react";
import type { ReportDto } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { BarChart } from "@/components/admin/charts";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Table, Td, Th } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const media = useApiQuery(() => apiClient.listMedia(), []);
  const groups = useApiQuery(() => apiClient.listPlaylists(), []);
  const screens = useApiQuery(() => apiClient.listScreens(), []);
  const companies = useApiQuery(apiClient.listCompanies, []);
  const today = new Date();
  const [filters, setFilters] = useState({
    from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: isoDate(today),
    mediaId: "",
    playlistId: "",
    screenId: "",
    companyId: ""
  });
  const [report, setReport] = useState<ReportDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as typeof filters;

  async function generate() {
    setIsLoading(true);
    try {
      setReport(await apiClient.getReport(cleanFilters));
    } catch (error) {
      toast({ title: "Não foi possível gerar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell description="Comprovação de exibição por mídia, grupo, terminal e período." title="Relatórios">
      <Card className="mb-5 bg-card/70">
        <CardContent className="grid gap-3 p-5 md:grid-cols-3 xl:grid-cols-7">
          <Field label="De">
            <Input onChange={(event) => setFilters({ ...filters, from: event.target.value })} type="date" value={filters.from} />
          </Field>
          <Field label="Até">
            <Input onChange={(event) => setFilters({ ...filters, to: event.target.value })} type="date" value={filters.to} />
          </Field>
          <Field label="Mídia">
            <Select onChange={(event) => setFilters({ ...filters, mediaId: event.target.value })} value={filters.mediaId}>
              <option value="">Todas</option>
              {media.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grupo">
            <Select onChange={(event) => setFilters({ ...filters, playlistId: event.target.value })} value={filters.playlistId}>
              <option value="">Todos</option>
              {groups.data?.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Terminal">
            <Select onChange={(event) => setFilters({ ...filters, screenId: event.target.value })} value={filters.screenId}>
              <option value="">Todos</option>
              {screens.data?.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Empresa">
            <Select onChange={(event) => setFilters({ ...filters, companyId: event.target.value })} value={filters.companyId}>
              <option value="">Todas</option>
              {companies.data?.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button className="w-full" disabled={isLoading} onClick={() => void generate()} type="button">
              {isLoading ? "Gerando..." : "Gerar relatório"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {report ? (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Gerado em {formatDate(report.generatedAt)} por {report.generatedBy} · {report.mediaTitle ?? report.playlistName ?? "Todas as mídias"}
            </span>
            <div className="flex gap-2">
              <a className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm text-foreground hover:bg-muted" href={apiClient.reportExportUrl("pdf", cleanFilters)}>
                <FileText className="h-4 w-4 text-red-400" /> PDF
              </a>
              <a className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm text-foreground hover:bg-muted" href={apiClient.reportExportUrl("xlsx", cleanFilters)}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Excel
              </a>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={PlayCircle} label="Exibições" value={report.totalPlays.toLocaleString("pt-BR")} />
            <Kpi icon={CalendarDays} label="Dias de campanha" value={String(report.campaignDays)} />
            <Kpi icon={Clock3} label="Tempo em tela" value={formatSeconds(report.totalSeconds)} />
            <Kpi icon={Tv} label="Terminais" value={String(report.screenCount)} />
          </div>
          {report.daily.length ? (
            <Card className="bg-card/70">
              <CardContent className="p-5">
                <p className="mb-3 text-sm font-medium">Exibições por dia</p>
                <BarChart data={report.daily.map((row) => ({ label: row.date, value: row.plays }))} formatLabel={(label) => label.slice(8, 10)} height={120} />
              </CardContent>
            </Card>
          ) : null}
          <Table>
            <thead>
              <tr>
                <Th>Terminal</Th>
                <Th>Exibições</Th>
                <Th>Tempo</Th>
                <Th>Última exibição</Th>
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 ? (
                <tr>
                  <Td className="text-center text-muted-foreground">Nenhuma exibição no período.</Td>
                </tr>
              ) : null}
              {report.rows.map((row) => (
                <tr key={row.screenId}>
                  <Td className="font-medium">{row.screenName}</Td>
                  <Td>{row.plays.toLocaleString("pt-BR")}</Td>
                  <Td>{formatSeconds(row.seconds)}</Td>
                  <Td className="text-xs text-muted-foreground">{row.lastPlayedAt ? formatDate(row.lastPlayedAt) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-sm font-semibold">
            Total de exibições: {report.totalPlays.toLocaleString("pt-BR")} · Quantidade de terminais: {report.screenCount}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Escolha os filtros e clique em “Gerar relatório”. As exibições são registradas pelo app da TV (versão 2 ou superior).</p>
      )}
    </AppShell>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof PlayCircle; label: string; value: string }) {
  return (
    <Card className="bg-card/70">
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
