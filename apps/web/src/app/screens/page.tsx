"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Monitor, Pencil, Plus, Search, Smartphone, Star, Trash2, Tv } from "lucide-react";
import type { ScreenDto } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "@/components/layout/session-context";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { IconButton } from "@/components/admin/pickers";
import { StatusBadge } from "@/components/admin/status-badge";
import { ScreenFormModal } from "@/components/screens/screen-form";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Badge, Input, PageActions, Table, Td, Th } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "online" | "offline";

export default function ScreensPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSession();
  const screens = useApiQuery(() => apiClient.listScreens(), []);
  const companies = useApiQuery(apiClient.listCompanies, []);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScreenDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScreenDto | null>(null);
  const [busy, setBusy] = useState(false);

  const list = screens.data ?? [];
  const online = list.filter((screen) => screen.status === "online").length;
  const visible = useMemo(
    () =>
      list.filter(
        (screen) =>
          (filter === "all" || screen.status === filter) &&
          (`${screen.name} ${screen.city ?? ""} ${screen.companyName ?? ""}`.toLowerCase().includes(search.toLowerCase()))
      ),
    [filter, list, search]
  );

  async function toggleFavorite(screen: ScreenDto) {
    try {
      await apiClient.updateScreen(screen.id, { isFavorite: !screen.isFavorite });
      await screens.refresh({ silent: true });
    } catch (error) {
      toast({ title: "Erro", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function duplicate(screen: ScreenDto) {
    try {
      const created = await apiClient.duplicateScreen(screen.id);
      toast({ title: "Terminal duplicado", description: `Código de ativação: ${created.activationCode}`, variant: "success" });
      await screens.refresh({ silent: true });
    } catch (error) {
      toast({ title: "Não foi possível duplicar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiClient.deleteScreen(deleteTarget.id);
      toast({ title: "Terminal excluído", variant: "success" });
      setDeleteTarget(null);
      await screens.refresh({ silent: true });
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell description="Cadastre TVs, acompanhe o status e monte a programação de cada uma." title="Terminais">
      <PageActions>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", `Todos (${list.length})`],
              ["online", `Online (${online})`],
              ["offline", `Offline (${list.length - online})`]
            ] as Array<[Filter, string]>
          ).map(([value, label]) => (
            <button
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium",
                filter === value
                  ? value === "online"
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                    : value === "offline"
                      ? "border-red-500/50 bg-red-500/15 text-red-300"
                      : "border-primary/50 bg-primary/15 text-primary"
                  : "text-muted-foreground"
              )}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}
            </button>
          ))}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="w-56 pl-9" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" value={search} />
          </div>
        </div>
        {session?.isAdmin ? (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            type="button"
          >
            <Plus className="h-4 w-4" /> Novo terminal
          </Button>
        ) : null}
      </PageActions>

      {screens.error ? <ErrorBanner message={screens.error} /> : null}
      {screens.isLoading && !screens.data ? <LoadingSkeleton className="h-64" /> : null}
      {list.length > 0 && online === 0 ? (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">Nenhum dos seus terminais está online.</div>
      ) : null}

      {screens.data && list.length === 0 ? (
        <EmptyState
          description="Cadastre o primeiro terminal e use o código de ativação no app da TV."
          icon={Tv}
          title="Nenhum terminal cadastrado"
        />
      ) : null}

      {visible.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Programação</Th>
              <Th>Mídias baixadas</Th>
              <Th>Status</Th>
              <Th>Última comunicação</Th>
              <Th className="text-right">Opções</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((screen) => (
              <tr className="cursor-pointer hover:bg-muted/20" key={screen.id} onClick={() => router.push(`/screens/${screen.id}`)}>
                <Td>
                  <div className="flex items-center gap-3">
                    {screen.imageUrl ? (
                      <img alt="" className="h-10 w-10 rounded-md object-cover" src={screen.imageUrl} />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                        {screen.orientation === "portrait" ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                      </span>
                    )}
                    <div className="min-w-0">
                      <Link className="font-medium hover:text-primary" href={`/screens/${screen.id}`} onClick={(event) => event.stopPropagation()}>
                        {screen.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {[screen.segment, screen.companyName, screen.city].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className="text-sm">{screen.itemCount} item(ns)</span>
                  <p className="text-xs text-muted-foreground">{formatDuration(screen.totalSeconds)}</p>
                </Td>
                <Td>
                  {screen.diagnostics?.totalItems != null ? (
                    <span className="text-sm">
                      {screen.diagnostics.cachedItems ?? 0}/{screen.diagnostics.totalItems}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </Td>
                <Td>
                  {screen.deviceKeyRegistered ? (
                    <StatusBadge status={screen.status} />
                  ) : (
                    <Badge tone="warn">Código {screen.activationCode}</Badge>
                  )}
                </Td>
                <Td className="text-xs text-muted-foreground">{screen.lastHeartbeatAt ? formatDate(screen.lastHeartbeatAt) : "Nunca"}</Td>
                <Td className="text-right">
                  <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                    <IconButton label={screen.isFavorite ? "Remover dos favoritos" : "Favoritar"} onClick={() => void toggleFavorite(screen)}>
                      <Star className={cn("h-4 w-4", screen.isFavorite && "fill-secondary text-secondary")} />
                    </IconButton>
                    {session?.isAdmin ? (
                      <>
                        <IconButton
                          label="Editar"
                          onClick={() => {
                            setEditing(screen);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="Duplicar" onClick={() => void duplicate(screen)}>
                          <Copy className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="Excluir" onClick={() => setDeleteTarget(screen)} tone="danger">
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}

      <ScreenFormModal
        companies={companies.data ?? []}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          void screens.refresh({ silent: true });
          if (!editing) {
            toast({ title: "Use este código no app da TV", description: saved.activationCode ?? "", variant: "info" });
          }
        }}
        open={formOpen}
        screen={editing}
      />
      <ConfirmDialog
        confirmLabel="Excluir terminal"
        description={`O terminal "${deleteTarget?.name}" será removido e a TV deixará de receber conteúdo. Essa ação não pode ser desfeita.`}
        isLoading={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        open={Boolean(deleteTarget)}
        title="Excluir terminal?"
      />
    </AppShell>
  );
}
