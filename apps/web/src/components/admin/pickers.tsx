"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarClock, ImagePlus, Loader2, Monitor, Search, Smartphone, Trash2, UploadCloud, X } from "lucide-react";
import { WEEKDAY_LABELS, type MediaDto, type ScheduleDto, type ScreenDto } from "@dialindooh/shared";
import { Button } from "@/components/ui/button";
import { Field, Input, Modal } from "@/components/ui/form";
import { useToast } from "@/components/feedback/toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDuration } from "@/lib/format";
import { uploadFile } from "@/lib/storage-client";
import { cn } from "@/lib/utils";

/* ---------- Seleção de telas ---------- */

export function ScreenPicker({
  screens,
  value,
  onChange,
  orientation
}: {
  screens: ScreenDto[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Mostra aviso quando a mídia só existe em uma orientação. */
  orientation?: "landscape" | "portrait" | null;
}) {
  const [search, setSearch] = useState("");
  const filtered = screens.filter((screen) => screen.name.toLowerCase().includes(search.toLowerCase()));
  const allSelected = screens.length > 0 && value.length === screens.length;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar terminal" value={search} />
        </div>
        <Button onClick={() => onChange(allSelected ? [] : screens.map((screen) => screen.id))} size="sm" type="button" variant="ghost">
          {allSelected ? "Limpar" : "Todos os terminais"}
        </Button>
      </div>
      <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2">
        {filtered.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Nenhum terminal encontrado.</p> : null}
        {filtered.map((screen) => {
          const checked = value.includes(screen.id);
          const mismatch = orientation && screen.orientation !== orientation;

          return (
            <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50" key={screen.id}>
              <input
                checked={checked}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
                onChange={() => onChange(checked ? value.filter((id) => id !== screen.id) : [...value, screen.id])}
                type="checkbox"
              />
              {screen.orientation === "portrait" ? <Smartphone className="h-4 w-4 text-muted-foreground" /> : <Monitor className="h-4 w-4 text-muted-foreground" />}
              <span className="flex-1 truncate">{screen.name}</span>
              {mismatch ? <span className="text-xs text-amber-300">orientação diferente</span> : null}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{value.length} terminal(is) selecionado(s)</p>
    </div>
  );
}

/* ---------- Seleção ordenada de mídias (grupos) ---------- */

export function MediaOrderPicker({ media, value, onChange }: { media: MediaDto[]; value: string[]; onChange: (value: string[]) => void }) {
  const [search, setSearch] = useState("");
  const byId = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const available = media.filter((item) => !value.includes(item.id) && item.title.toLowerCase().includes(search.toLowerCase()));

  function move(index: number, offset: number) {
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + offset, 0, item);
    onChange(next);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="grid content-start gap-2">
        <p className="text-sm font-medium">Mídias disponíveis</p>
        <Input onChange={(event) => setSearch(event.target.value)} placeholder="Buscar mídia" value={search} />
        <div className="grid max-h-72 gap-1 overflow-y-auto rounded-md border p-2">
          {available.map((item) => (
            <button
              className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
              key={item.id}
              onClick={() => onChange([...value, item.id])}
              type="button"
            >
              <MediaThumb media={item} />
              <span className="flex-1 truncate">{item.title}</span>
              <span className="text-xs text-primary">Adicionar</span>
            </button>
          ))}
          {available.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Nada para adicionar.</p> : null}
        </div>
      </div>
      <div className="grid content-start gap-2">
        <p className="text-sm font-medium">Ordem no grupo ({value.length})</p>
        <div className="grid max-h-[22rem] gap-1 overflow-y-auto rounded-md border p-2">
          {value.map((id, index) => {
            const item = byId.get(id);
            return (
              <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-sm" key={`${id}-${index}`}>
                <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
                {item ? <MediaThumb media={item} /> : null}
                <span className="flex-1 truncate">{item?.title ?? "Mídia removida"}</span>
                <IconButton disabled={index === 0} label="Subir" onClick={() => move(index, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton disabled={index === value.length - 1} label="Descer" onClick={() => move(index, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton label="Remover" onClick={() => onChange(value.filter((_, position) => position !== index))}>
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            );
          })}
          {value.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Clique nas mídias ao lado para adicionar.</p> : null}
        </div>
      </div>
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
  tone = "default"
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30",
        tone === "danger" && "hover:bg-red-500/15 hover:text-red-300"
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

/* ---------- Miniaturas ---------- */

const TYPE_COLORS: Record<string, string> = {
  clock: "bg-blue-600",
  currency: "bg-violet-600",
  weather: "bg-sky-600",
  rss: "bg-amber-500",
  notice: "bg-red-600",
  instagram: "bg-pink-600",
  youtube: "bg-red-700",
  url: "bg-slate-600"
};

const TYPE_SHORT: Record<string, string> = {
  clock: "HORA",
  currency: "US$",
  weather: "CLIMA",
  rss: "RSS",
  notice: "AVISO",
  instagram: "INSTA",
  youtube: "YT",
  url: "WEB"
};

export function MediaThumb({ media, className }: { media: Pick<MediaDto, "type" | "thumbnailUrl" | "fileUrl" | "fileUrlVertical" | "title" | "config">; className?: string }) {
  const base = cn("h-9 w-14 shrink-0 overflow-hidden rounded bg-black object-cover", className);
  const youtubeId = media.type === "youtube" ? ((media.config as { videoId?: string } | null)?.videoId ?? null) : null;

  if (media.thumbnailUrl) {
    return <img alt="" className={base} src={media.thumbnailUrl} />;
  }

  if (youtubeId) {
    return <img alt="" className={base} src={`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`} />;
  }

  if (media.type === "image") {
    return <img alt="" className={base} src={media.fileUrl || media.fileUrlVertical || ""} />;
  }

  if (media.type === "video") {
    return <video className={base} muted preload="metadata" src={`${media.fileUrl || media.fileUrlVertical}#t=1`} />;
  }

  return (
    <span className={cn(base, "flex items-center justify-center text-[10px] font-bold text-white", TYPE_COLORS[media.type] ?? "bg-muted")}>
      {TYPE_SHORT[media.type] ?? "•"}
    </span>
  );
}

/* ---------- Upload de imagem simples (logos, capas) ---------- */

export function ImageUploadField({
  label,
  value,
  onChange,
  hint,
  aspect = "square"
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
  aspect?: "square" | "wide";
}) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Escolha um arquivo de imagem.", variant: "error" });
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadFile(file);
      onChange(uploaded.url);
    } catch (error) {
      toast({ title: "Falha no envio", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Field hint={hint} label={label}>
      <div className="flex items-center gap-3">
        <div className={cn("flex items-center justify-center overflow-hidden rounded-md border bg-background/60", aspect === "wide" ? "h-16 w-32" : "h-16 w-16")}>
          {value ? <img alt="" className="h-full w-full object-contain" src={value} /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {isUploading ? "Enviando..." : "Escolher arquivo"}
          <input accept="image/*" className="sr-only" onChange={(event) => void handleFile(event.target.files?.item(0) ?? null)} type="file" />
        </label>
        {value ? (
          <IconButton label="Remover imagem" onClick={() => onChange(null)} tone="danger">
            <Trash2 className="h-4 w-4" />
          </IconButton>
        ) : null}
      </div>
    </Field>
  );
}

/* ---------- Agendamento ---------- */

export const EMPTY_SCHEDULE: ScheduleDto = { startsAt: null, endsAt: null, timeFrom: null, timeTo: null, weekdays: [] };

export function hasSchedule(schedule: ScheduleDto | null | undefined) {
  return Boolean(schedule && (schedule.startsAt || schedule.endsAt || schedule.timeFrom || schedule.timeTo || schedule.weekdays.length));
}

export function describeSchedule(schedule: ScheduleDto | null | undefined) {
  if (!schedule || !hasSchedule(schedule)) return "Sempre";
  const parts: string[] = [];
  const date = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  if (schedule.startsAt || schedule.endsAt) parts.push(`${schedule.startsAt ? date(schedule.startsAt) : "…"} a ${schedule.endsAt ? date(schedule.endsAt) : "…"}`);
  if (schedule.timeFrom || schedule.timeTo) parts.push(`${schedule.timeFrom ?? "00:00"}–${schedule.timeTo ?? "24:00"}`);
  if (schedule.weekdays.length) parts.push(schedule.weekdays.map((day) => WEEKDAY_LABELS[day]?.slice(0, 3)).join(", "));
  return parts.join(" · ");
}

export function ScheduleButton({ value, onChange }: { value: ScheduleDto; onChange: (value: ScheduleDto) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ScheduleDto>(value);
  const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const fromDateInput = (date: string) => (date ? `${date}T12:00:00.000Z` : null);

  return (
    <>
      <Button
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        type="button"
        variant="secondary"
      >
        <CalendarClock className="h-4 w-4" />
        {hasSchedule(value) ? `Agendado: ${describeSchedule(value)}` : "Agendamento"}
      </Button>
      <Modal
        footer={
          <>
            <Button
              onClick={() => {
                onChange(EMPTY_SCHEDULE);
                setOpen(false);
              }}
              type="button"
              variant="ghost"
            >
              Remover agendamento
            </Button>
            <Button
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              type="button"
            >
              Agendar
            </Button>
          </>
        }
        onClose={() => setOpen(false)}
        open={open}
        size="sm"
        title="Agendamento"
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Iniciar em">
              <Input onChange={(event) => setDraft({ ...draft, startsAt: fromDateInput(event.target.value) })} type="date" value={toDateInput(draft.startsAt)} />
            </Field>
            <Field label="Finalizar em">
              <Input onChange={(event) => setDraft({ ...draft, endsAt: fromDateInput(event.target.value) })} type="date" value={toDateInput(draft.endsAt)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Exibir a partir de">
              <Input onChange={(event) => setDraft({ ...draft, timeFrom: event.target.value || null })} type="time" value={draft.timeFrom ?? ""} />
            </Field>
            <Field label="Até">
              <Input onChange={(event) => setDraft({ ...draft, timeTo: event.target.value || null })} type="time" value={draft.timeTo ?? ""} />
            </Field>
          </div>
          <WeekdayPicker onChange={(weekdays) => setDraft({ ...draft, weekdays })} value={draft.weekdays} />
          <p className="text-xs text-muted-foreground">Sem dias marcados, a mídia toca todos os dias. O horário segue o fuso de cada terminal.</p>
        </div>
      </Modal>
    </>
  );
}

export function WeekdayPicker({ value, onChange, label = "Dias da semana" }: { value: number[]; onChange: (value: number[]) => void; label?: string }) {
  return (
    <div className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_LABELS.map((day, index) => {
          const active = value.includes(index);
          return (
            <button
              className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", active ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
              key={day}
              onClick={() => onChange(active ? value.filter((item) => item !== index) : [...value, index].sort())}
              type="button"
            >
              {day.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function durationLabel(seconds: number) {
  return formatDuration(seconds);
}
