"use client";

import { useState } from "react";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import type { PlaylistDto } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { IconButton, MediaThumb } from "@/components/admin/pickers";
import { GroupFormModal } from "@/components/playlists/group-form";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Badge, PageActions, Table, Td, Th } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function GroupsPage() {
  const { toast } = useToast();
  const groups = useApiQuery(() => apiClient.listPlaylists(), []);
  const [form, setForm] = useState<{ group: PlaylistDto | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlaylistDto | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.deletePlaylist(deleteTarget.id);
      setDeleteTarget(null);
      await groups.refresh({ silent: true });
      toast({ title: "Grupo excluído", variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <AppShell description="Agrupe mídias e inclua o grupo inteiro nos terminais de uma vez." title="Grupos">
      <PageActions>
        <p className="text-sm text-muted-foreground">{groups.data?.length ?? 0} grupo(s)</p>
        <Button onClick={() => setForm({ group: null })} type="button">
          <Plus className="h-4 w-4" /> Novo grupo
        </Button>
      </PageActions>
      {groups.error ? <ErrorBanner message={groups.error} /> : null}
      {groups.isLoading && !groups.data ? <LoadingSkeleton className="h-64" /> : null}
      {groups.data?.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setForm({ group: null })} type="button">
              <Plus className="h-4 w-4" /> Criar grupo
            </Button>
          }
          description="Ex.: “Datas sazonais”, “Cardápio do almoço”, “Campanha de verão”."
          icon={FolderKanban}
          title="Nenhum grupo ainda"
        />
      ) : null}
      {groups.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Mídias</Th>
              <Th>Terminais</Th>
              <Th>Situação</Th>
              <Th>Modificação</Th>
              <Th className="text-right">Opções</Th>
            </tr>
          </thead>
          <tbody>
            {groups.data.map((group) => (
              <tr className="hover:bg-muted/20" key={group.id}>
                <Td>
                  <button className="flex items-center gap-3 text-left" onClick={() => setForm({ group })} type="button">
                    {group.imageUrl ? (
                      <img alt="" className="h-10 w-10 rounded-md object-cover" src={group.imageUrl} />
                    ) : group.items[0] ? (
                      <MediaThumb className="h-10 w-10" media={group.items[0].media} />
                    ) : (
                      <span className="h-10 w-10 rounded-md bg-muted" />
                    )}
                    <span className="font-medium hover:text-primary">{group.name}</span>
                  </button>
                </Td>
                <Td>{group.items.length}</Td>
                <Td>{group.screenCount ?? 0}</Td>
                <Td>{group.isActive ? <Badge tone="success">Ativo</Badge> : <Badge>Inativo</Badge>}</Td>
                <Td className="text-xs text-muted-foreground">{formatDate(group.updatedAt)}</Td>
                <Td className="text-right">
                  <div className="flex justify-end">
                    <IconButton label="Editar" onClick={() => setForm({ group })}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Excluir" onClick={() => setDeleteTarget(group)} tone="danger">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      <GroupFormModal group={form?.group ?? null} onClose={() => setForm(null)} onSaved={() => void groups.refresh({ silent: true })} open={Boolean(form)} />
      <ConfirmDialog
        confirmLabel="Excluir grupo"
        description={`O grupo "${deleteTarget?.name}" sairá de todos os terminais. As mídias continuam na sua biblioteca.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        open={Boolean(deleteTarget)}
        title="Excluir grupo?"
      />
    </AppShell>
  );
}
