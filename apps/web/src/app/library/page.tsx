"use client";

import { useState } from "react";
import { Library, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { MEDIA_TYPE_LABELS, type MediaDto, type PlaylistDto, type ScreenDto } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "@/components/layout/session-context";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { IconButton, MediaThumb, ScreenPicker } from "@/components/admin/pickers";
import { GroupFormModal } from "@/components/playlists/group-form";
import { DynamicMediaPreview } from "@/components/widgets/media-preview";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Badge, Modal, PageActions } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

export default function LibraryPage() {
  const { toast } = useToast();
  const { session } = useSession();
  const library = useApiQuery(() => apiClient.listPlaylists({ library: true }), []);
  const libraryMedia = useApiQuery(() => apiClient.listMedia({ library: true }), []);
  const [includeMedia, setIncludeMedia] = useState<MediaDto | null>(null);
  const screens = useApiQuery(() => apiClient.listScreens(), []);
  const [includeTarget, setIncludeTarget] = useState<PlaylistDto | null>(null);
  const [screenIds, setScreenIds] = useState<string[]>([]);
  const [previewTarget, setPreviewTarget] = useState<PlaylistDto | null>(null);
  const [form, setForm] = useState<{ group: PlaylistDto | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlaylistDto | null>(null);
  const groups = (library.data ?? []).filter((group) => group.isActive || session?.isSuperadmin);
  const categories = [...new Set(groups.map((group) => group.category || "Conteúdos"))];

  async function include() {
    if (!includeTarget || screenIds.length === 0) return;
    try {
      await apiClient.includePlaylistInScreens(includeTarget.id, screenIds);
      toast({ title: "Conteúdo incluído", description: `Adicionado em ${screenIds.length} terminal(is).`, variant: "success" });
      setIncludeTarget(null);
    } catch (error) {
      toast({ title: "Não foi possível incluir", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function includeMediaInScreens() {
    if (!includeMedia || screenIds.length === 0) return;
    try {
      await apiClient.includeMediaInScreens(includeMedia.id, screenIds);
      toast({ title: "Conteúdo incluído", description: `Adicionado em ${screenIds.length} terminal(is).`, variant: "success" });
      setIncludeMedia(null);
    } catch (error) {
      toast({ title: "Não foi possível incluir", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.deletePlaylist(deleteTarget.id);
      setDeleteTarget(null);
      await library.refresh({ silent: true });
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <AppShell description="Conteúdos prontos para incluir nos seus terminais com um clique." title="Biblioteca">
      {session?.isSuperadmin ? (
        <PageActions>
          <p className="text-sm text-muted-foreground">Como administrador da plataforma, você publica conteúdos para todos os clientes.</p>
          <Button onClick={() => setForm({ group: null })} type="button">
            <Plus className="h-4 w-4" /> Publicar conteúdo
          </Button>
        </PageActions>
      ) : null}
      {library.error ? <ErrorBanner message={library.error} /> : null}
      {library.isLoading && !library.data ? <LoadingSkeleton className="h-64" /> : null}
      {libraryMedia.data?.length ? (
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold text-primary">Conteúdos dinâmicos prontos</h2>
          <p className="mb-3 text-sm text-muted-foreground">Atualizam sozinhos (hora, cotação, clima, notícias, frases, feriados). Escolha e inclua nos terminais.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {libraryMedia.data.map((item) => (
              <div className="overflow-hidden rounded-lg border bg-card/70" key={item.id}>
                <DynamicMediaPreview media={item} />
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={item.title}>
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {MEDIA_TYPE_LABELS[item.type]} · {item.durationSeconds ?? 15}s
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setScreenIds([]);
                      setIncludeMedia(item);
                    }}
                    size="sm"
                    type="button"
                  >
                    Incluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {library.data && groups.length === 0 && !libraryMedia.data?.length ? (
        <EmptyState description="Em breve novos conteúdos prontos estarão disponíveis aqui." icon={Library} title="Biblioteca vazia" />
      ) : null}

      {categories.map((category) => (
        <section className="mb-8" key={category}>
          <h2 className="mb-3 text-lg font-semibold text-primary">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groups
              .filter((group) => (group.category || "Conteúdos") === category)
              .map((group) => (
                <div className="overflow-hidden rounded-lg border bg-card/70" key={group.id}>
                  <button className="group relative block aspect-video w-full bg-black" onClick={() => setPreviewTarget(group)} type="button">
                    {group.imageUrl ? (
                      <img alt="" className="h-full w-full object-cover" src={group.imageUrl} />
                    ) : group.items[0] ? (
                      <MediaThumb className="h-full w-full rounded-none" media={group.items[0].media} />
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-80 transition group-hover:opacity-100">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90">
                        <Play className="h-6 w-6 fill-white text-white" />
                      </span>
                    </span>
                  </button>
                  <div className="grid gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{group.name}</p>
                        <p className="text-xs text-muted-foreground">{group.items.length} mídia(s)</p>
                      </div>
                      {!group.isActive ? <Badge>Oculto</Badge> : null}
                    </div>
                    {group.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{group.description}</p> : null}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setScreenIds([]);
                          setIncludeTarget(group);
                        }}
                        size="sm"
                        type="button"
                      >
                        Incluir nos terminais
                      </Button>
                      {session?.isSuperadmin ? (
                        <>
                          <IconButton label="Editar" onClick={() => setForm({ group })}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Excluir" onClick={() => setDeleteTarget(group)} tone="danger">
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}

      <Modal
        footer={
          <>
            <Button onClick={() => setIncludeTarget(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={screenIds.length === 0} onClick={() => void include()} type="button">
              Incluir
            </Button>
          </>
        }
        onClose={() => setIncludeTarget(null)}
        open={Boolean(includeTarget)}
        title={`Incluir “${includeTarget?.name}”`}
      >
        <ScreenPicker onChange={setScreenIds} screens={(screens.data ?? []) as ScreenDto[]} value={screenIds} />
      </Modal>

      <Modal
        footer={
          <>
            <Button onClick={() => setIncludeMedia(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={screenIds.length === 0} onClick={() => void includeMediaInScreens()} type="button">
              Incluir
            </Button>
          </>
        }
        onClose={() => setIncludeMedia(null)}
        open={Boolean(includeMedia)}
        title={`Incluir “${includeMedia?.title}”`}
      >
        <ScreenPicker onChange={setScreenIds} screens={(screens.data ?? []) as ScreenDto[]} value={screenIds} />
      </Modal>

      <Modal onClose={() => setPreviewTarget(null)} open={Boolean(previewTarget)} size="lg" title={previewTarget?.name ?? ""}>
        <div className="grid gap-3 sm:grid-cols-2">
          {previewTarget?.items.map((item) =>
            item.media.type === "video" ? (
              <video className="aspect-video w-full rounded-md bg-black" controls key={item.id} preload="metadata" src={item.media.fileUrl || item.media.fileUrlVertical || ""} />
            ) : item.media.type === "image" ? (
              <img alt={item.media.title} className="aspect-video w-full rounded-md bg-black object-contain" key={item.id} src={item.media.fileUrl || item.media.fileUrlVertical || ""} />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-sm" key={item.id}>
                {item.media.title}
              </div>
            )
          )}
        </div>
      </Modal>

      <GroupFormModal group={form?.group ?? null} library onClose={() => setForm(null)} onSaved={() => void library.refresh({ silent: true })} open={Boolean(form)} />
      <ConfirmDialog
        confirmLabel="Excluir"
        description="O conteúdo sairá da biblioteca e de todos os terminais dos clientes."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        open={Boolean(deleteTarget)}
        title="Excluir conteúdo da biblioteca?"
      />
    </AppShell>
  );
}
