"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { PlaylistDto } from "@dialindooh/shared";
import { ListVideo, Pencil, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function PlaylistsPage() {
  const { toast } = useToast();
  const query = useApiQuery(apiClient.listPlaylists, []);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledStartAt, setScheduledStartAt] = useState("");
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PlaylistDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const playlists = query.data ?? [];

  async function createPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);

    try {
      await apiClient.createPlaylist({
        name,
        description: description || null,
        isActive: true,
        scheduledStartAt: toIsoDateTime(scheduledStartAt),
        scheduledEndAt: toIsoDateTime(scheduledEndAt)
      });
      toast({ title: "Playlist criada", description: name, variant: "success" });
      setName("");
      setDescription("");
      setScheduledStartAt("");
      setScheduledEndAt("");
      await query.refresh();
    } catch (error) {
      toast({ title: "Falha ao criar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  async function updatePlaylist(id: string, input: { name?: string; description?: string | null; isActive?: boolean }) {
    try {
      await apiClient.updatePlaylist(id, input);
      toast({ title: "Playlist atualizada", variant: "success" });
      setEditingId(null);
      await query.refresh();
    } catch (error) {
      toast({ title: "Falha ao atualizar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function confirmDeletePlaylist() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      await apiClient.deletePlaylist(deleteTarget.id);
      toast({ title: "Playlist apagada", description: deleteTarget.name, variant: "success" });
      if (editingId === deleteTarget.id) {
        setEditingId(null);
      }
      setDeleteTarget(null);
      await query.refresh();
    } catch (error) {
      toast({ title: "Falha ao apagar playlist", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Card className="h-fit bg-card/70">
          <CardHeader>
            <CardTitle>Criar playlist</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createPlaylist}>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Playlist da recepção"
                required
                value={name}
              />
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setDescription(event.currentTarget.value)}
                placeholder="Descrição"
                value={description}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Início
                  <input
                    className="h-10 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    onChange={(event) => setScheduledStartAt(event.currentTarget.value)}
                    type="datetime-local"
                    value={scheduledStartAt}
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Fim
                  <input
                    className="h-10 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                    onChange={(event) => setScheduledEndAt(event.currentTarget.value)}
                    type="datetime-local"
                    value={scheduledEndAt}
                  />
                </label>
              </div>
              <Button className="w-full" disabled={isCreating} type="submit">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {isCreating ? "Criando..." : "Criar playlist"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {query.error ? (
          <ErrorBanner message={query.error} />
        ) : query.isLoading ? (
          <LoadingSkeleton className="h-96" />
        ) : playlists.length === 0 ? (
          <EmptyState icon={ListVideo} title="Nenhuma playlist cadastrada" description="Crie uma playlist para montar a sequência das telas." />
        ) : (
          <div className="grid gap-4">
            {playlists.map((playlist) => {
              const isEditing = editingId === playlist.id;

              return (
                <Card className="bg-card/70" key={playlist.id}>
                  <CardContent className="p-5">
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        {isEditing ? (
                          <EditPlaylistForm
                            defaultDescription={playlist.description ?? ""}
                            defaultEndAt={toLocalDateTimeInput(playlist.scheduledEndAt)}
                            defaultName={playlist.name}
                            defaultStartAt={toLocalDateTimeInput(playlist.scheduledStartAt)}
                            onCancel={() => setEditingId(null)}
                            onSave={(input) => updatePlaylist(playlist.id, input)}
                          />
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-3">
                              <h2 className="text-lg font-semibold">{playlist.name}</h2>
                              <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                                {playlist.isActive ? "Ativa" : "Inativa"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{playlist.description ?? "Sem descrição"}</p>
                            <p className="mt-3 text-xs text-muted-foreground">
                              {playlist.items.length} item(ns) · Atualizada em {formatDate(playlist.updatedAt)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Janela: {formatDate(playlist.scheduledStartAt)} até {formatDate(playlist.scheduledEndAt)}
                            </p>
                            {playlist.items.length > 0 ? (
                              <ol className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {playlist.items.slice(0, 6).map((item) => (
                                  <li className="rounded-full border px-2.5 py-1" key={item.id}>
                                    {item.order}. {item.media.title}
                                  </li>
                                ))}
                              </ol>
                            ) : null}
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button asChild type="button" variant="secondary">
                          <Link href={`/playlists/${playlist.id}`}>Abrir</Link>
                        </Button>
                        <Button onClick={() => setEditingId(playlist.id)} type="button" variant="ghost">
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Editar
                        </Button>
                        <Button
                          onClick={() => updatePlaylist(playlist.id, { isActive: !playlist.isActive })}
                          type="button"
                          variant="ghost"
                        >
                          {playlist.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          {playlist.isActive ? "Desativar" : "Ativar"}
                        </Button>
                        <Button
                          aria-label={`Apagar ${playlist.name}`}
                          className="border border-border bg-background/60"
                          onClick={() => setDeleteTarget(playlist)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Apagar playlist?"
        description={
          deleteTarget
            ? `A playlist "${deleteTarget.name}" será removida junto com seus itens e deixará de estar atribuída às telas.`
            : "Essa ação não pode ser desfeita."
        }
        confirmLabel="Apagar"
        isLoading={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePlaylist}
      />
    </AppShell>
  );
}

function EditPlaylistForm({
  defaultName,
  defaultDescription,
  defaultStartAt,
  defaultEndAt,
  onCancel,
  onSave
}: {
  defaultName: string;
  defaultDescription: string;
  defaultStartAt: string;
  defaultEndAt: string;
  onCancel: () => void;
  onSave: (input: { name: string; description: string | null; scheduledStartAt: string | null; scheduledEndAt: string | null }) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [scheduledStartAt, setScheduledStartAt] = useState(defaultStartAt);
  const [scheduledEndAt, setScheduledEndAt] = useState(defaultEndAt);

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          name,
          description: description || null,
          scheduledStartAt: toIsoDateTime(scheduledStartAt),
          scheduledEndAt: toIsoDateTime(scheduledEndAt)
        });
      }}
    >
      <input
        className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setName(event.currentTarget.value)}
        value={name}
      />
      <textarea
        className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        onChange={(event) => setDescription(event.currentTarget.value)}
        value={description}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          onChange={(event) => setScheduledStartAt(event.currentTarget.value)}
          type="datetime-local"
          value={scheduledStartAt}
        />
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          onChange={(event) => setScheduledEndAt(event.currentTarget.value)}
          type="datetime-local"
          value={scheduledEndAt}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">Salvar</Button>
        <Button onClick={onCancel} type="button" variant="ghost">
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}
