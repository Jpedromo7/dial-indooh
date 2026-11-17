"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cake, CalendarDays, CloudSun, Clock, QrCode, Quote, Timer, DollarSign, Film, Instagram, Link2, ListVideo, Megaphone, Newspaper, Pencil, Plus, Search, Trash2, Youtube } from "lucide-react";
import { MEDIA_TYPE_LABELS, type MediaDto, type MediaType } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { LoadingSkeleton } from "@/components/admin/loading-skeleton";
import { describeSchedule, hasSchedule, IconButton, MediaThumb } from "@/components/admin/pickers";
import { MediaFormModal, type MediaFormKind } from "@/components/media/media-form";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Badge, Input, Modal, PageActions, Select, Table, Td, Th } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate, formatDuration } from "@/lib/format";

const WIDGET_ROUTES: Partial<Record<MediaType, string>> = {
  clock: "/widgets/clock",
  currency: "/widgets/currency",
  weather: "/widgets/weather",
  rss: "/widgets/rss",
  notice: "/widgets/notice",
  instagram: "/widgets/instagram",
  quote: "/widgets/quote",
  countdown: "/widgets/countdown",
  holidays: "/widgets/holidays",
  birthdays: "/widgets/birthdays",
  qrcode: "/widgets/qrcode"
};

export default function MediaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const media = useApiQuery(() => apiClient.listMedia(), []);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [form, setForm] = useState<{ kind: MediaFormKind; media: MediaDto | null } | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<MediaDto[]>([]);
  const [busy, setBusy] = useState(false);

  const list = useMemo(
    () =>
      (media.data ?? []).filter(
        (item) => (!typeFilter || item.type === typeFilter) && `${item.title} ${item.companyName ?? ""} ${item.category ?? ""}`.toLowerCase().includes(search.toLowerCase())
      ),
    [media.data, search, typeFilter]
  );

  function edit(item: MediaDto) {
    const widgetRoute = WIDGET_ROUTES[item.type];
    if (widgetRoute) {
      router.push(`${widgetRoute}?edit=${item.id}`);
      return;
    }
    setForm({ kind: item.type === "youtube" ? "youtube" : item.type === "url" ? "url" : "file", media: item });
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      const result = await apiClient.deleteMediaMany(deleteTargets.map((item) => item.id));
      if (result.skipped.length) {
        toast({
          title: `${result.deleted.length} excluída(s), ${result.skipped.length} mantida(s)`,
          description: "Mídias que estão em grupos não podem ser excluídas. Remova-as dos grupos antes.",
          variant: "info"
        });
      } else {
        toast({ title: "Mídias excluídas", variant: "success" });
      }
      setSelected([]);
      setDeleteTargets([]);
      await media.refresh({ silent: true });
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const allSelected = list.length > 0 && list.every((item) => selected.includes(item.id));

  return (
    <AppShell description="Vídeos, imagens, links e conteúdos dinâmicos que vão para as telas." title="Mídias">
      <PageActions>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="w-56 pl-9" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar mídia" value={search} />
          </div>
          <Select className="w-44" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
            <option value="">Todos os tipos</option>
            {Object.entries(MEDIA_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          {selected.length ? (
            <Button onClick={() => setDeleteTargets((media.data ?? []).filter((item) => selected.includes(item.id)))} type="button" variant="destructive">
              <Trash2 className="h-4 w-4" /> Excluir {selected.length}
            </Button>
          ) : null}
        </div>
        <Button onClick={() => setChooserOpen(true)} type="button">
          <Plus className="h-4 w-4" /> Nova mídia
        </Button>
      </PageActions>

      {media.error ? <ErrorBanner message={media.error} /> : null}
      {media.isLoading && !media.data ? <LoadingSkeleton className="h-64" /> : null}
      {media.data && media.data.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setChooserOpen(true)} type="button">
              <Plus className="h-4 w-4" /> Nova mídia
            </Button>
          }
          description="Envie vídeos e imagens ou crie conteúdos dinâmicos como hora certa, cotação e notícias."
          icon={ListVideo}
          title="Nenhuma mídia ainda"
        />
      ) : null}

      {list.length ? (
        <Table>
          <thead>
            <tr>
              <Th className="w-8">
                <input
                  aria-label="Selecionar todas"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : list.map((item) => item.id))}
                  type="checkbox"
                />
              </Th>
              <Th>Nome</Th>
              <Th>Tipo</Th>
              <Th>Duração</Th>
              <Th>Terminais</Th>
              <Th>Agendamento</Th>
              <Th>Modificação</Th>
              <Th className="text-right">Opções</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((item) => (
              <tr className="hover:bg-muted/20" key={item.id}>
                <Td>
                  <input
                    aria-label={`Selecionar ${item.title}`}
                    checked={selected.includes(item.id)}
                    onChange={() => setSelected(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])}
                    type="checkbox"
                  />
                </Td>
                <Td>
                  <button className="flex items-center gap-3 text-left" onClick={() => edit(item)} type="button">
                    <MediaThumb media={item} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium hover:text-primary">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.companyName ?? "Avulso"}{item.category ? ` · ${item.category}` : ""}</span>
                    </span>
                  </button>
                </Td>
                <Td>
                  <Badge>{MEDIA_TYPE_LABELS[item.type]}</Badge>
                  {item.type === "image" || item.type === "video" ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {item.fileUrl ? "H" : ""}
                      {item.fileUrl && item.fileUrlVertical ? "+" : ""}
                      {item.fileUrlVertical ? "V" : ""}
                    </span>
                  ) : null}
                </Td>
                <Td>{formatDuration(item.durationSeconds ?? (item.type === "image" ? 10 : 15))}</Td>
                <Td>{item.screenCount ?? 0}</Td>
                <Td className="max-w-[12rem] truncate text-xs text-muted-foreground">
                  {hasSchedule(item.schedule) ? <Badge tone="info">{describeSchedule(item.schedule)}</Badge> : "Sempre"}
                </Td>
                <Td className="text-xs text-muted-foreground">{formatDate(item.updatedAt)}</Td>
                <Td className="text-right">
                  <div className="flex justify-end">
                    <IconButton label="Editar" onClick={() => edit(item)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Excluir" onClick={() => setDeleteTargets([item])} tone="danger">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}

      <Modal onClose={() => setChooserOpen(false)} open={chooserOpen} title="Nova mídia" description="Escolha o tipo de conteúdo." size="lg">
        <div className="grid gap-3 sm:grid-cols-3">
          <ChooserButton icon={Film} label="Vídeo / Imagem" onClick={() => { setChooserOpen(false); setForm({ kind: "file", media: null }); }} />
          <ChooserButton icon={Youtube} label="Link do YouTube" onClick={() => { setChooserOpen(false); setForm({ kind: "youtube", media: null }); }} />
          <ChooserButton icon={Link2} label="Link externo" onClick={() => { setChooserOpen(false); setForm({ kind: "url", media: null }); }} />
          <ChooserLink href="/widgets/clock" icon={Clock} label="Hora certa" />
          <ChooserLink href="/widgets/currency" icon={DollarSign} label="Cotação" />
          <ChooserLink href="/widgets/weather" icon={CloudSun} label="Clima" />
          <ChooserLink href="/widgets/rss" icon={Newspaper} label="Notícias RSS" />
          <ChooserLink href="/widgets/notice" icon={Megaphone} label="Aviso" />
          <ChooserLink href="/widgets/instagram" icon={Instagram} label="Instagram" />
          <ChooserLink href="/widgets/quote" icon={Quote} label="Frase do dia" />
          <ChooserLink href="/widgets/countdown" icon={Timer} label="Contagem regressiva" />
          <ChooserLink href="/widgets/holidays" icon={CalendarDays} label="Feriados" />
          <ChooserLink href="/widgets/birthdays" icon={Cake} label="Aniversariantes" />
          <ChooserLink href="/widgets/qrcode" icon={QrCode} label="QR Code" />
        </div>
      </Modal>

      {form ? (
        <MediaFormModal
          kind={form.kind}
          media={form.media}
          onClose={() => setForm(null)}
          onSaved={() => void media.refresh({ silent: true })}
          open
        />
      ) : null}

      <ConfirmDialog
        confirmLabel="Excluir"
        description={`${deleteTargets.length} mídia(s) serão removidas de todos os terminais. Essa ação não pode ser desfeita.`}
        isLoading={busy}
        onCancel={() => setDeleteTargets([])}
        onConfirm={() => void confirmDelete()}
        open={deleteTargets.length > 0}
        title="Excluir mídias?"
      />
    </AppShell>
  );
}

function ChooserButton({ icon: Icon, label, onClick }: { icon: typeof Film; label: string; onClick: () => void }) {
  return (
    <button className="flex flex-col items-center gap-2 rounded-lg border p-5 text-sm font-medium transition hover:border-primary hover:bg-primary/5" onClick={onClick} type="button">
      <Icon className="h-7 w-7 text-primary" />
      {label}
    </button>
  );
}

function ChooserLink({ icon: Icon, label, href }: { icon: typeof Film; label: string; href: string }) {
  return (
    <Link className="flex flex-col items-center gap-2 rounded-lg border p-5 text-sm font-medium transition hover:border-primary hover:bg-primary/5" href={`${href}?new=1`}>
      <Icon className="h-7 w-7 text-primary" />
      {label}
    </Link>
  );
}
