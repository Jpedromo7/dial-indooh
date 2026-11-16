"use client";

import { useEffect, useState } from "react";
import type { CompanyDto, MediaDto, ScheduleDto, ScreenDto } from "@dialindooh/shared";
import { EMPTY_SCHEDULE, ScheduleButton, ScreenPicker } from "@/components/admin/pickers";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { apiClient } from "@/lib/api-client";

export interface BaseMediaState {
  title: string;
  companyId: string | null;
  category: string;
  durationSeconds: number | null;
  recordStats: boolean;
  schedule: ScheduleDto;
  screenIds: string[];
}

export function baseFromMedia(media: MediaDto | null, defaults: Partial<BaseMediaState> = {}): BaseMediaState {
  return {
    title: media?.title ?? defaults.title ?? "",
    companyId: media?.companyId ?? defaults.companyId ?? null,
    category: media?.category ?? defaults.category ?? "",
    durationSeconds: media?.durationSeconds ?? defaults.durationSeconds ?? 15,
    recordStats: media?.recordStats ?? true,
    schedule: media?.schedule ?? EMPTY_SCHEDULE,
    screenIds: defaults.screenIds ?? []
  };
}

/** Carrega empresas, terminais e (na edição) os terminais em que a mídia já está. */
export function useMediaFormData(open: boolean, mediaId: string | null) {
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [screens, setScreens] = useState<ScreenDto[]>([]);
  const [screenIds, setScreenIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    apiClient.listCompanies().then(setCompanies).catch(() => undefined);
    apiClient.listScreens().then(setScreens).catch(() => undefined);
    setScreenIds(null);
    if (mediaId) {
      apiClient.getMediaScreens(mediaId).then(setScreenIds).catch(() => setScreenIds([]));
    } else {
      setScreenIds([]);
    }
  }, [mediaId, open]);

  return { companies, screens, screenIds };
}

export function BaseMediaFields({
  value,
  onChange,
  companies,
  screens,
  showDuration = true,
  durationHint,
  orientation
}: {
  value: BaseMediaState;
  onChange: (value: BaseMediaState) => void;
  companies: CompanyDto[];
  screens: ScreenDto[];
  showDuration?: boolean;
  durationHint?: string;
  orientation?: "landscape" | "portrait" | null;
}) {
  const set = <K extends keyof BaseMediaState>(key: K, next: BaseMediaState[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" required>
          <Input onChange={(event) => set("title", event.target.value)} value={value.title} />
        </Field>
        <Field label="Empresa">
          <Select onChange={(event) => set("companyId", event.target.value || null)} value={value.companyId ?? ""}>
            <option value="">Avulso (sem empresa)</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoria">
          <Input list="media-categories" onChange={(event) => set("category", event.target.value)} placeholder="Geral" value={value.category} />
          <datalist id="media-categories">
            {["Geral", "Promoção", "Institucional", "Cardápio", "Entretenimento", "Notícias", "Saúde"].map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
        {showDuration ? (
          <Field hint={durationHint} label="Duração (segundos)" required>
            <Input
              max={3600}
              min={1}
              onChange={(event) => set("durationSeconds", event.target.value ? Number(event.target.value) : null)}
              type="number"
              value={value.durationSeconds ?? ""}
            />
          </Field>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Switch checked={value.recordStats} label="Gravar estatísticas" onChange={(next) => set("recordStats", next)} />
        <ScheduleButton onChange={(next) => set("schedule", next)} value={value.schedule} />
      </div>
      <Field label="Incluir nos terminais">
        <ScreenPicker onChange={(next) => set("screenIds", next)} orientation={orientation} screens={screens} value={value.screenIds} />
      </Field>
    </div>
  );
}

export function basePayload(value: BaseMediaState) {
  return {
    title: value.title.trim(),
    companyId: value.companyId,
    category: value.category.trim() || null,
    durationSeconds: value.durationSeconds,
    recordStats: value.recordStats,
    schedule: value.schedule,
    screenIds: value.screenIds
  };
}
