"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  KeyRound,
  ListPlus,
  Pencil,
  Plus,
  Save,
  Shuffle,
  Star,
  Trash2,
  Volume2,
  VolumeX
} from "lucide-react";
import type { MediaDto, PlaylistDto, RemoteControlKey, ScreenCommandType, ScreenItemDto } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "@/components/layout/session-context";
import { BarChart, monthLabel } from "@/components/admin/charts";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { describeSchedule, hasSchedule, IconButton, MediaThumb } from "@/components/admin/pickers";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  DetailLine,
  LivePreview,
  RecentCommands,
  RecentEvents,
  RemoteCommands,
  ScreenMirrorPanel,
  VirtualRemote
} from "@/components/screens/live-tools";
import { ScreenFormModal } from "@/components/screens/screen-form";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Input, Modal, Switch, Tabs, Textarea } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const DETAIL_REFRESH_MS = 8000;

interface DraftItem {
  key: string;
  mediaId: string | null;
  playlistId: string | null;
  durationSeconds: number | null;
  title: string;
  subtitle: string;
  seconds: number;
  media: MediaDto | null;
  playlistImage: string | null;
}

function toDraft(item: ScreenItemDto): DraftItem {
  if (item.playlist) {
    return {
      key: item.id,
      mediaId: null,
      playlistId: item.playlist.id,
      durationSeconds: null,
      title: item.playlist.name,
      subtitle: `${item.playlist.isLibrary ? "Biblioteca · " : "Grupo · "}${item.playlist.itemCount} mídia(s)`,
      seconds: item.playlist.totalSeconds,
      media: null,
      playlistImage: item.playlist.imageUrl
    };
  }

  const media = item.media;
  return {
    key: item.id,
    mediaId: item.mediaId,
    playlistId: null,
    durationSeconds: item.durationSeconds,
    title: media?.title ?? "Mídia removida",
    subtitle: [media?.companyName ?? "Avulso", media && hasSchedule(media.schedule) ? describeSchedule(media.schedule) : null].filter(Boolean).join(" · "),
    seconds: item.durationSeconds ?? media?.durationSeconds ?? (media?.type === "video" ? 30 : media?.type === "image" ? 10 : 15),
    media,
    playlistImage: null
  };
}

export default function ScreenDetailPage() {
  const params = useParams<{ id: string }>();
  const screenId = params.id;
  const { toast } = useToast();
  const { session } = useSession();
  const detail = useApiQuery(() => apiClient.getScreen(screenId), [screenId]);
  const companies = useApiQuery(apiClient.listCompanies, []);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [tab, setTab] = useState<"overview" | "control" | "events">("overview");
  const data = detail.data;

  useEffect(() => {
    if (data && !dirty) {
      setItems(data.items.map(toDraft));
    }
  }, [data, dirty]);

  useEffect(() => {
    if (data) setNotes(data.notes ?? "");
  }, [data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(() => void detail.refresh({ silent: true }), DETAIL_REFRESH_MS);
    return () => clearInterval(interval);
  }, [detail.refresh]);

  const totalSeconds = useMemo(() => items.reduce((total, item) => total + item.seconds, 0), [items]);

  function updateItems(next: DraftItem[]) {
    setItems(next);
    setDirty(true);
  }

  function move(index: number, offset: number) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + offset, 0, item);
    updateItems(next);
  }

  function shuffleOnce() {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [next[index], next[swap]] = [next[swap]!, next[index]!];
    }
    updateItems(next);
  }

  async function saveItems() {
    setIsSaving(true);
    try {
      await apiClient.replaceScreenItems(
        screenId,
        items.map((item) => ({ mediaId: item.mediaId, playlistId: item.playlistId, durationSeconds: item.durationSeconds }))
      );
      setDirty(false);
      await detail.refresh({ silent: true });
      await apiClient.createScreenCommand(screenId, "refresh_playlist").catch(() => undefined);
      toast({ title: "Lista de reprodução salva", description: "A TV recebe a nova programação em instantes.", variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function patchScreen(input: Parameters<typeof apiClient.updateScreen>[1], message?: string) {
    try {
      await apiClient.updateScreen(screenId, input);
      await detail.refresh({ silent: true });
      if (message) toast({ title: message, variant: "success" });
    } catch (error) {
      toast({ title: "Erro", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function sendCommand(type: ScreenCommandType, payload?: Record<string, unknown>) {
    try {
      await apiClient.createScreenCommand(screenId, type, payload);
      await detail.refresh({ silent: true });
      if (type !== "remote_key") toast({ title: "Comando enviado", variant: "success" });
    } catch (error) {
      toast({ title: "Falha ao enviar comando", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function resetPairing() {
    try {
      const screen = await apiClient.resetScreenPairing(screenId);
      setResetOpen(false);
      await detail.refresh({ silent: true });
      toast({ title: "Novo código de ativação", description: screen.activationCode ?? "", variant: "success" });
    } catch (error) {
      toast({ title: "Erro", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <AppShell description="Programação, status e controle remoto do terminal." title={data?.name ?? "Terminal"}>
      <div className="mb-4 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/screens">
          Terminais
        </Link>{" "}
        / <span className="text-foreground">{data?.name ?? "…"}</span>
      </div>
      {detail.error ? <ErrorBanner message={detail.error} /> : null}
      {!data && detail.isLoading ? <LoadingSkeleton className="h-96" /> : null}

      {data ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_26rem]">
          <div className="grid content-start gap-5">
            <Card className="bg-card/70">
              <CardContent className="flex flex-wrap items-start gap-4 p-5">
                {data.imageUrl ? (
                  <img alt="" className="h-20 w-20 rounded-lg object-cover" src={data.imageUrl} />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">sem imagem</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{[data.segment, data.companyName].filter(Boolean).join(" · ")}</p>
                  <h2 className="text-2xl font-semibold">{data.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="accent">{data.orientation === "portrait" ? "Vertical" : "Horizontal"}</Badge>
                    {data.deviceKeyRegistered ? <StatusBadge status={data.status} /> : <Badge tone="danger">App não ativado</Badge>}
                    {data.footerEnabled ? <Badge tone="warn">Rodapé</Badge> : null}
                    <Badge tone={data.soundEnabled ? "success" : "default"}>
                      {data.soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                      {data.soundEnabled ? "Som ligado" : "Sem som"}
                    </Badge>
                    {data.diagnostics?.appVersion ? <Badge>App {data.diagnostics.appVersion}</Badge> : null}
                  </div>
                  {!data.deviceKeyRegistered && data.activationCode ? (
                    <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
                      Código de ativação para o app da TV: <span className="font-mono text-lg font-bold tracking-widest">{data.activationCode}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <IconButton label={data.isFavorite ? "Remover dos favoritos" : "Favoritar"} onClick={() => void patchScreen({ isFavorite: !data.isFavorite })}>
                    <Star className={cn("h-4 w-4", data.isFavorite && "fill-secondary text-secondary")} />
                  </IconButton>
                  {session?.isAdmin ? (
                    <>
                      <IconButton label="Editar terminal" onClick={() => setEditOpen(true)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Gerar novo código (trocar aparelho)" onClick={() => setResetOpen(true)}>
                        <KeyRound className="h-4 w-4" />
                      </IconButton>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Tabs
              onChange={setTab}
              options={[
                { value: "overview", label: "Visão geral" },
                { value: "control", label: "Controle remoto" },
                { value: "events", label: "Eventos" }
              ]}
              value={tab}
            />

            {tab === "overview" ? (
              <>
                <Card className="bg-card/70">
                  <CardHeader>
                    <CardTitle className="text-base">Exibições por mês</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChart data={data.monthlyPlays.map((row) => ({ label: row.month, value: row.plays }))} formatLabel={monthLabel} height={140} />
                  </CardContent>
                </Card>
                <div className="grid gap-5 lg:grid-cols-2">
                  <LivePreview detail={data} />
                  <Card className="bg-card/70">
                    <CardHeader>
                      <CardTitle className="text-base">Diagnóstico</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm">
                      <DetailLine label="Última comunicação" value={data.lastHeartbeatAt ? formatDate(data.lastHeartbeatAt) : "Nunca"} />
                      <DetailLine
                        label="Mídias baixadas"
                        value={data.diagnostics?.totalItems != null ? `${data.diagnostics.cachedItems ?? 0} de ${data.diagnostics.totalItems}` : "—"}
                      />
                      <DetailLine
                        label="Espaço livre"
                        value={data.diagnostics?.freeDiskBytes != null ? formatBytes(data.diagnostics.freeDiskBytes) : "—"}
                      />
                      <DetailLine label="Aparelho" value={[data.diagnostics?.deviceModel, data.diagnostics?.osVersion].filter(Boolean).join(" · ") || "—"} />
                      <DetailLine
                        label="Sobrepor outros apps"
                        value={data.diagnostics?.overlayPermission == null ? "—" : data.diagnostics.overlayPermission ? "Permitido" : "Não permitido"}
                      />
                      <DetailLine label="Endereço IP" value={data.lastHeartbeat?.ipAddress ?? "—"} />
                      <DetailLine label="Fuso" value={data.timezone} />
                      <DetailLine label="Atualização" value={`a cada ${data.refreshMinutes} min`} />
                    </CardContent>
                  </Card>
                </div>
                <Card className="bg-card/70">
                  <CardHeader>
                    <CardTitle className="text-base">Anotações</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <Textarea
                      className="min-h-32"
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Contato do responsável, observações de instalação, senha do Wi-Fi do local..."
                      value={notes}
                    />
                    <div className="flex justify-end">
                      <Button disabled={notes === (data.notes ?? "")} onClick={() => void patchScreen({ notes }, "Anotações salvas")} size="sm" type="button">
                        <Save className="h-4 w-4" /> Salvar anotações
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}

            {tab === "control" ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="grid content-start gap-5">
                  <LivePreview detail={data} />
                  <VirtualRemote onRemoteKey={(key: RemoteControlKey) => void sendCommand("remote_key", { key })} />
                  <RemoteCommands onCommand={(type) => void sendCommand(type)} />
                </div>
                <div className="grid content-start gap-5">
                  <ScreenMirrorPanel detail={data} />
                  <RecentCommands detail={data} />
                </div>
              </div>
            ) : null}

            {tab === "events" ? <RecentEvents detail={data} /> : null}
          </div>

          <Card className="h-fit bg-card/70 xl:sticky xl:top-24">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Lista de reprodução</CardTitle>
              <Button onClick={() => setPickerOpen(true)} size="sm" type="button">
                <Plus className="h-4 w-4" /> Incluir mídia
              </Button>
            </CardHeader>
            <CardContent className="grid gap-2">
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Nenhuma mídia. Clique em “Incluir mídia” para montar a programação.
                  </p>
                ) : null}
                {items.map((item, index) => (
                  <div className="flex items-center gap-2 border-b border-white/5 py-2" key={item.key}>
                    {item.media ? (
                      <MediaThumb media={item.media} />
                    ) : item.playlistImage ? (
                      <img alt="" className="h-9 w-14 rounded object-cover" src={item.playlistImage} />
                    ) : (
                      <span className="flex h-9 w-14 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary">GRUPO</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.subtitle} · {item.playlistId ? "~" : ""}
                        {formatDuration(item.seconds)}
                      </p>
                    </div>
                    <IconButton disabled={index === 0} label="Subir" onClick={() => move(index, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton disabled={index === items.length - 1} label="Descer" onClick={() => move(index, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Remover" onClick={() => updateItems(items.filter((_, position) => position !== index))} tone="danger">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <span className="text-sm text-muted-foreground">
                  {items.length} item(ns) · {formatDuration(totalSeconds)}
                </span>
                <div className="flex gap-2">
                  <Button disabled={items.length < 2} onClick={shuffleOnce} size="sm" title="Embaralhar a ordem agora" type="button" variant="secondary">
                    <Shuffle className="h-4 w-4" />
                  </Button>
                  <Button disabled={!dirty || isSaving} onClick={() => void saveItems()} size="sm" type="button">
                    <Save className="h-4 w-4" /> {isSaving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
              <Switch
                checked={data.shuffle}
                description="A TV sorteia a ordem a cada volta completa."
                label="Reprodução aleatória contínua"
                onChange={(value) => void patchScreen({ shuffle: value })}
              />
              {dirty ? <p className="text-xs text-amber-300">Alterações não salvas.</p> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {data ? (
        <AddItemModal
          onAdd={(added) => {
            updateItems([...items, ...added]);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          open={pickerOpen}
          orientation={data.orientation}
        />
      ) : null}
      {data ? (
        <ScreenFormModal
          companies={companies.data ?? []}
          onClose={() => setEditOpen(false)}
          onSaved={() => void detail.refresh({ silent: true })}
          open={editOpen}
          screen={data}
        />
      ) : null}
      <ConfirmDialog
        confirmLabel="Gerar novo código"
        description="A TV atual será desconectada e precisará ser ativada de novo com o novo código. Use ao trocar o aparelho."
        onCancel={() => setResetOpen(false)}
        onConfirm={() => void resetPairing()}
        open={resetOpen}
        title="Trocar o aparelho deste terminal?"
      />
    </AppShell>
  );
}

function AddItemModal({
  open,
  onClose,
  onAdd,
  orientation
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: DraftItem[]) => void;
  orientation: "landscape" | "portrait";
}) {
  const [tab, setTab] = useState<"media" | "groups" | "library">("media");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const media = useApiQuery(() => (open ? apiClient.listMedia() : Promise.resolve([] as MediaDto[])), [open]);
  const groups = useApiQuery(() => (open ? apiClient.listPlaylists() : Promise.resolve([] as PlaylistDto[])), [open]);
  const library = useApiQuery(() => (open ? apiClient.listPlaylists({ library: true }) : Promise.resolve([] as PlaylistDto[])), [open]);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setSearch("");
    }
  }, [open]);

  const groupList = tab === "groups" ? groups.data ?? [] : library.data ?? [];
  const filteredMedia = (media.data ?? []).filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = groupList.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  function confirm() {
    const added: DraftItem[] = [];

    if (tab === "media") {
      for (const id of selected) {
        const item = media.data?.find((entry) => entry.id === id);
        if (item) {
          added.push(
            toDraft({ id: `new-${id}-${Date.now()}`, order: 0, durationSeconds: null, mediaId: id, playlistId: null, media: item, playlist: null })
          );
        }
      }
    } else {
      for (const id of selected) {
        const group = groupList.find((entry) => entry.id === id);
        if (group) {
          const total = group.items.reduce(
            (sum, entry) => sum + (entry.displayDurationSeconds ?? entry.media.durationSeconds ?? (entry.media.type === "video" ? 30 : 10)),
            0
          );
          added.push(
            toDraft({
              id: `new-${id}-${Date.now()}`,
              order: 0,
              durationSeconds: null,
              mediaId: null,
              playlistId: id,
              media: null,
              playlist: { id, name: group.name, imageUrl: group.imageUrl, isLibrary: group.isLibrary, itemCount: group.items.length, totalSeconds: total }
            })
          );
        }
      }
    }

    onAdd(added);
  }

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button disabled={selected.length === 0} onClick={confirm} type="button">
            <ListPlus className="h-4 w-4" /> Incluir {selected.length || ""}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      size="lg"
      title="Incluir na lista de reprodução"
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            onChange={(value) => {
              setTab(value);
              setSelected([]);
            }}
            options={[
              { value: "media", label: "Mídias" },
              { value: "groups", label: "Grupos" },
              { value: "library", label: "Biblioteca" }
            ]}
            value={tab}
          />
          <Input className="max-w-xs flex-1" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" value={search} />
        </div>
        <div className="grid max-h-[50vh] gap-1 overflow-y-auto">
          {tab === "media"
            ? filteredMedia.map((item) => {
                const checked = selected.includes(item.id);
                const missingOrientation =
                  (item.type === "image" || item.type === "video") &&
                  (orientation === "portrait" ? !item.fileUrlVertical : !item.fileUrl);
                return (
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40" key={item.id}>
                    <input
                      checked={checked}
                      className="h-4 w-4"
                      onChange={() => setSelected(checked ? selected.filter((id) => id !== item.id) : [...selected, item.id])}
                      type="checkbox"
                    />
                    <MediaThumb media={item} />
                    <span className="flex-1 truncate text-sm">{item.title}</span>
                    {missingOrientation ? <Badge tone="warn">sem versão {orientation === "portrait" ? "vertical" : "horizontal"}</Badge> : null}
                  </label>
                );
              })
            : filteredGroups.map((group) => {
                const checked = selected.includes(group.id);
                return (
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40" key={group.id}>
                    <input
                      checked={checked}
                      className="h-4 w-4"
                      onChange={() => setSelected(checked ? selected.filter((id) => id !== group.id) : [...selected, group.id])}
                      type="checkbox"
                    />
                    {group.imageUrl ? <img alt="" className="h-9 w-14 rounded object-cover" src={group.imageUrl} /> : <span className="h-9 w-14 rounded bg-primary/20" />}
                    <span className="flex-1 truncate text-sm">{group.name}</span>
                    <span className="text-xs text-muted-foreground">{group.items.length} mídia(s)</span>
                  </label>
                );
              })}
          {(tab === "media" ? filteredMedia.length : filteredGroups.length) === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Nada encontrado.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
