"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Plus, Trash2 } from "lucide-react";
import { qrText, type BirthdayPerson, type QrCodeConfig } from "@dialindooh/shared";
import { IconButton, ImageUploadField } from "@/components/admin/pickers";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

type Config = Record<string, unknown>;
type Setter = (key: string, value: unknown) => void;

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function QuoteEditor({ config, set }: { config: Config; set: Setter }) {
  const theme = (config.theme as string) ?? "motivacional";
  return (
    <>
      <Field label="Tema">
        <Select onChange={(event) => set("theme", event.target.value)} value={theme}>
          <option value="motivacional">Frase motivacional</option>
          <option value="curiosidades">Você sabia? (curiosidades)</option>
          <option value="saude">Dica de saúde</option>
          <option value="personalizado">Minhas frases</option>
        </Select>
      </Field>
      <Field hint="Ex.: Frase do dia, Você sabia?, Dica de saúde" label="Título">
        <Input maxLength={80} onChange={(event) => set("title", event.target.value)} value={(config.title as string) ?? ""} />
      </Field>
      {theme === "personalizado" ? (
        <Field hint="Uma frase por linha. A TV mostra uma por dia, em rodízio." label="Suas frases">
          <Textarea
            className="min-h-40"
            onChange={(event) =>
              set(
                "phrases",
                event.target.value
                  .split("\n")
                  .map((line) => line.slice(0, 280))
                  .slice(0, 100)
              )
            }
            value={((config.phrases as string[]) ?? []).join("\n")}
          />
        </Field>
      ) : (
        <p className="text-xs text-muted-foreground">Textos prontos selecionados pela plataforma; muda automaticamente todo dia.</p>
      )}
    </>
  );
}

export function CountdownEditor({ config, set }: { config: Config; set: Setter }) {
  const target = (config.target as string) ?? "";
  const local = target ? toLocalInput(target) : "";
  return (
    <>
      <Field label="Título" required>
        <Input maxLength={120} onChange={(event) => set("title", event.target.value)} placeholder="Faltam para o Natal" value={(config.title as string) ?? ""} />
      </Field>
      <Field label="Data e hora do evento" required>
        <Input
          onChange={(event) => set("target", event.target.value ? new Date(event.target.value).toISOString() : "")}
          type="datetime-local"
          value={local}
        />
      </Field>
      <Field label="Texto quando chegar a data">
        <Input maxLength={160} onChange={(event) => set("finishedText", event.target.value)} placeholder="Feliz Natal!" value={(config.finishedText as string) ?? ""} />
      </Field>
      <ImageUploadField label="Imagem (opcional)" onChange={(url) => set("imageUrl", url)} value={(config.imageUrl as string) ?? null} />
    </>
  );
}

export function HolidaysEditor({ config, set }: { config: Config; set: Setter }) {
  return (
    <>
      <Field label="Título">
        <Input maxLength={80} onChange={(event) => set("title", event.target.value)} placeholder="Próximos feriados" value={(config.title as string) ?? ""} />
      </Field>
      <Field label="Quantidade de feriados">
        <Select onChange={(event) => set("count", Number(event.target.value))} value={String(config.count ?? 4)}>
          {[2, 3, 4, 5, 6].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-xs text-muted-foreground">Feriados nacionais atualizados automaticamente.</p>
    </>
  );
}

export function BirthdaysEditor({ config, set }: { config: Config; set: Setter }) {
  const people = (config.people as BirthdayPerson[]) ?? [];
  const [draft, setDraft] = useState({ name: "", day: "", month: String(new Date().getMonth() + 1), role: "" });

  function add() {
    if (!draft.name.trim() || !draft.day) return;
    set("people", [...people, { name: draft.name.trim(), day: Number(draft.day), month: Number(draft.month), role: draft.role.trim() || null }]);
    setDraft({ ...draft, name: "", day: "", role: "" });
  }

  return (
    <>
      <Field hint="Vazio mostra “Aniversariantes de <mês>”." label="Título">
        <Input maxLength={80} onChange={(event) => set("title", event.target.value)} value={(config.title as string) ?? ""} />
      </Field>
      <div className="grid gap-2 rounded-md border p-3">
        <p className="text-sm font-medium">Adicionar pessoa</p>
        <div className="grid grid-cols-[1fr_4rem_5rem] gap-2">
          <Input onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nome" value={draft.name} />
          <Input max={31} min={1} onChange={(event) => setDraft({ ...draft, day: event.target.value })} placeholder="Dia" type="number" value={draft.day} />
          <Select onChange={(event) => setDraft({ ...draft, month: event.target.value })} value={draft.month}>
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Input onChange={(event) => setDraft({ ...draft, role: event.target.value })} placeholder="Cargo/setor (opcional)" value={draft.role} />
          <Button onClick={add} type="button" variant="secondary">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>
      <div className="grid max-h-56 gap-1 overflow-y-auto">
        {people
          .map((person, index) => ({ person, index }))
          .sort((left, right) => left.person.month - right.person.month || left.person.day - right.person.day)
          .map(({ person, index }) => (
            <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-sm" key={`${person.name}-${index}`}>
              <span className="w-14 text-xs text-muted-foreground">
                {String(person.day).padStart(2, "0")}/{MONTHS[person.month - 1]}
              </span>
              <span className="flex-1 truncate">{person.name}</span>
              {person.role ? <span className="truncate text-xs text-muted-foreground">{person.role}</span> : null}
              <IconButton label="Remover" onClick={() => set("people", people.filter((_, position) => position !== index))} tone="danger">
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        {people.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma pessoa cadastrada.</p> : null}
      </div>
      <p className="text-xs text-muted-foreground">Na TV aparecem só os aniversariantes do mês atual; em meses sem aniversariante o conteúdo é pulado.</p>
    </>
  );
}

export function QrEditor({ config, set }: { config: Config; set: Setter }) {
  const kind = (config.kind as string) ?? "url";
  const labels: Record<string, [string, string]> = {
    url: ["Endereço do site", "https://..."],
    whatsapp: ["Número do WhatsApp (com DDD)", "(85) 9 9999-9999"],
    instagram: ["Perfil do Instagram", "@sualoja"],
    wifi: ["Nome da rede Wi-Fi", "Loja-Clientes"],
    text: ["Texto", "Qualquer texto"]
  };
  const [label, placeholder] = labels[kind] ?? labels.url!;

  return (
    <>
      <Field label="Tipo">
        <Select onChange={(event) => set("kind", event.target.value)} value={kind}>
          <option value="url">Site / link</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="wifi">Wi-Fi para clientes</option>
          <option value="text">Texto</option>
        </Select>
      </Field>
      <Field label={label} required>
        <Input onChange={(event) => set("value", event.target.value)} placeholder={placeholder} value={(config.value as string) ?? ""} />
      </Field>
      {kind === "wifi" ? (
        <Field hint="Vazio para rede aberta." label="Senha do Wi-Fi">
          <Input onChange={(event) => set("wifiPassword", event.target.value)} value={(config.wifiPassword as string) ?? ""} />
        </Field>
      ) : null}
      <Field label="Título" required>
        <Input maxLength={120} onChange={(event) => set("title", event.target.value)} placeholder="Fale com a gente no WhatsApp" value={(config.title as string) ?? ""} />
      </Field>
      <Field label="Subtítulo">
        <Input maxLength={200} onChange={(event) => set("subtitle", event.target.value)} placeholder="Aponte a câmera do celular" value={(config.subtitle as string) ?? ""} />
      </Field>
    </>
  );
}

export function useQrImage(config: Config) {
  const [image, setImage] = useState<string | null>(null);
  const key = JSON.stringify([config.kind, config.value, config.wifiPassword]);

  useEffect(() => {
    const value = (config.value as string) ?? "";
    if (!value.trim()) {
      setImage(null);
      return;
    }
    const text = qrText({ ...(config as unknown as QrCodeConfig), value });
    QRCode.toDataURL(text, { margin: 1, width: 320 }).then(setImage).catch(() => setImage(null));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return image;
}

function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
