"use client";

import { useEffect, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { SCREEN_SEGMENTS, type CompanyDto, type ScreenDto } from "@dialindooh/shared";
import { ImageUploadField, WeekdayPicker } from "@/components/admin/pickers";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Modal, Select, Switch } from "@/components/ui/form";
import { apiClient, getApiErrorMessage, type ScreenInput } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const STATES = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Belem",
  "America/Manaus",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha"
];

type FormState = ScreenInput & { name: string };

function toForm(screen?: ScreenDto | null): FormState {
  return {
    name: screen?.name ?? "",
    companyId: screen?.companyId ?? null,
    imageUrl: screen?.imageUrl ?? null,
    segment: screen?.segment ?? "Geral",
    street: screen?.street ?? "",
    streetNumber: screen?.streetNumber ?? "",
    complement: screen?.complement ?? "",
    zipCode: screen?.zipCode ?? "",
    district: screen?.district ?? "",
    state: screen?.state ?? "",
    city: screen?.city ?? "",
    phone1: screen?.phone1 ?? "",
    phone2: screen?.phone2 ?? "",
    openFrom: screen?.openFrom ?? "",
    openTo: screen?.openTo ?? "",
    openDays: screen?.openDays ?? [],
    footfall: screen?.footfall ?? null,
    socialClasses: screen?.socialClasses ?? [],
    refreshMinutes: screen?.refreshMinutes ?? 5,
    soundEnabled: screen?.soundEnabled ?? false,
    timezone: screen?.timezone ?? "America/Sao_Paulo",
    footerEnabled: screen?.footerEnabled ?? false,
    orientation: screen?.orientation ?? "landscape",
    location: screen?.location ?? ""
  };
}

export function ScreenFormModal({
  open,
  screen,
  companies,
  onClose,
  onSaved
}: {
  open: boolean;
  screen?: ScreenDto | null;
  companies: CompanyDto[];
  onClose: () => void;
  onSaved: (screen: ScreenDto) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => toForm(screen));
  const [cities, setCities] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (open) setForm(toForm(screen));
  }, [open, screen]);

  useEffect(() => {
    if (!form.state) {
      setCities([]);
      return;
    }

    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${form.state}/municipios?orderBy=nome`)
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: Array<{ nome: string }>) => setCities(rows.map((row) => row.nome)))
      .catch(() => setCities([]));
  }, [form.state]);

  async function lookupZip(zip: string) {
    const digits = zip.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await response.json()) as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };
      if (data.erro) return;
      setForm((current) => ({
        ...current,
        street: current.street || data.logradouro || "",
        district: current.district || data.bairro || "",
        state: data.uf || current.state,
        city: data.localidade || current.city
      }));
    } catch {
      // Consulta de CEP é opcional.
    }
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Informe o nome do terminal.", variant: "error" });
      return;
    }

    setIsSaving(true);
    try {
      const payload: FormState = {
        ...form,
        openFrom: form.openFrom || null,
        openTo: form.openTo || null,
        state: form.state || null,
        footfall: form.footfall ? Number(form.footfall) : null
      };
      const saved = screen ? await apiClient.updateScreen(screen.id, payload) : await apiClient.createScreen(payload);
      toast({ title: screen ? "Terminal atualizado" : "Terminal cadastrado", variant: "success" });
      onSaved(saved);
      onClose();
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getApiErrorMessage(error), variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button disabled={isSaving} onClick={() => void save()} type="button">
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      size="lg"
      title={screen ? `Editar terminal — ${screen.name}` : "Novo terminal"}
    >
      <div className="grid gap-5">
        {!screen ? (
          <div className="grid grid-cols-2 gap-3">
            {(["landscape", "portrait"] as const).map((orientation) => (
              <button
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition",
                  form.orientation === orientation ? "border-primary bg-primary/10" : "hover:bg-muted/40"
                )}
                key={orientation}
                onClick={() => set("orientation", orientation)}
                type="button"
              >
                {orientation === "landscape" ? <Monitor className="h-6 w-6 text-primary" /> : <Smartphone className="h-6 w-6 text-primary" />}
                <span>
                  <span className="block font-medium">{orientation === "landscape" ? "TV horizontal" : "TV vertical"}</span>
                  <span className="text-xs text-muted-foreground">{orientation === "landscape" ? "16:9 deitada" : "9:16 em pé"}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Informações</h3>
          <ImageUploadField hint="Tamanho sugerido: 600x600" label="Imagem" onChange={(url) => set("imageUrl", url)} value={form.imageUrl ?? null} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" required>
              <Input onChange={(event) => set("name", event.target.value)} value={form.name} />
            </Field>
            <Field label="Empresa">
              <Select onChange={(event) => set("companyId", event.target.value || null)} value={form.companyId ?? ""}>
                <option value="">Sem empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Segmento">
              <Select onChange={(event) => set("segment", event.target.value)} value={form.segment ?? "Geral"}>
                {SCREEN_SEGMENTS.map((segment) => (
                  <option key={segment}>{segment}</option>
                ))}
              </Select>
            </Field>
            <Field label="Local (descrição)">
              <Input onChange={(event) => set("location", event.target.value)} placeholder="Ex.: recepção, caixa 2" value={form.location ?? ""} />
            </Field>
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Endereço</h3>
          <div className="grid gap-3 sm:grid-cols-6">
            <Field className="sm:col-span-2" label="CEP">
              <Input onBlur={(event) => void lookupZip(event.target.value)} onChange={(event) => set("zipCode", event.target.value)} value={form.zipCode ?? ""} />
            </Field>
            <Field className="sm:col-span-3" label="Rua">
              <Input onChange={(event) => set("street", event.target.value)} value={form.street ?? ""} />
            </Field>
            <Field label="Número">
              <Input onChange={(event) => set("streetNumber", event.target.value)} value={form.streetNumber ?? ""} />
            </Field>
            <Field className="sm:col-span-3" label="Complemento">
              <Input onChange={(event) => set("complement", event.target.value)} value={form.complement ?? ""} />
            </Field>
            <Field className="sm:col-span-3" label="Bairro">
              <Input onChange={(event) => set("district", event.target.value)} value={form.district ?? ""} />
            </Field>
            <Field className="sm:col-span-2" label="Estado">
              <Select onChange={(event) => set("state", event.target.value)} value={form.state ?? ""}>
                <option value="">UF</option>
                {STATES.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </Select>
            </Field>
            <Field className="sm:col-span-4" hint="Usada para o clima do terminal." label="Cidade">
              <Input list="screen-cities" onChange={(event) => set("city", event.target.value)} value={form.city ?? ""} />
              <datalist id="screen-cities">
                {cities.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </Field>
            <Field className="sm:col-span-3" label="Telefone 1">
              <Input onChange={(event) => set("phone1", event.target.value)} placeholder="(99) 9 9999-9999" value={form.phone1 ?? ""} />
            </Field>
            <Field className="sm:col-span-3" label="Telefone 2">
              <Input onChange={(event) => set("phone2", event.target.value)} placeholder="(99) 9 9999-9999" value={form.phone2 ?? ""} />
            </Field>
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Funcionamento e público</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Abre às">
              <Input onChange={(event) => set("openFrom", event.target.value)} type="time" value={form.openFrom ?? ""} />
            </Field>
            <Field label="Fecha às">
              <Input onChange={(event) => set("openTo", event.target.value)} type="time" value={form.openTo ?? ""} />
            </Field>
          </div>
          <WeekdayPicker label="Dias de funcionamento" onChange={(value) => set("openDays", value)} value={form.openDays ?? []} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fluxo médio de pessoas (mês)">
              <Input min={0} onChange={(event) => set("footfall", event.target.value ? Number(event.target.value) : null)} type="number" value={form.footfall ?? ""} />
            </Field>
            <div className="grid gap-1.5 text-sm">
              <span className="font-medium">Classe social</span>
              <div className="flex gap-1.5">
                {(["A", "B", "C", "D"] as const).map((value) => {
                  const active = form.socialClasses?.includes(value);
                  return (
                    <button
                      className={cn("h-10 flex-1 rounded-md border text-sm font-semibold", active ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground")}
                      key={value}
                      onClick={() =>
                        set("socialClasses", active ? (form.socialClasses ?? []).filter((item) => item !== value) : [...(form.socialClasses ?? []), value])
                      }
                      type="button"
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Configurações</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Orientação">
              <Select onChange={(event) => set("orientation", event.target.value as "landscape" | "portrait")} value={form.orientation}>
                <option value="landscape">Horizontal</option>
                <option value="portrait">Vertical</option>
              </Select>
            </Field>
            <Field hint="Com que frequência a TV busca a programação." label="Ciclo de atualização (min)">
              <Input max={240} min={1} onChange={(event) => set("refreshMinutes", Number(event.target.value) || 5)} type="number" value={form.refreshMinutes ?? 5} />
            </Field>
            <Field label="Fuso horário">
              <Select onChange={(event) => set("timezone", event.target.value)} value={form.timezone}>
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace("America/", "").replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-6">
            <Switch checked={Boolean(form.soundEnabled)} label="Som do terminal" onChange={(value) => set("soundEnabled", value)} />
            <Switch checked={Boolean(form.footerEnabled)} label="Barra de rodapé" onChange={(value) => set("footerEnabled", value)} />
          </div>
        </section>
      </div>
    </Modal>
  );
}
