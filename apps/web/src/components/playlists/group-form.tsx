"use client";

import { useEffect, useState } from "react";
import type { MediaDto, PlaylistDto, ScreenDto } from "@dialindooh/shared";
import { ImageUploadField, MediaOrderPicker, ScreenPicker } from "@/components/admin/pickers";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Modal, Switch, Textarea } from "@/components/ui/form";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

export function GroupFormModal({
  open,
  group,
  library = false,
  onClose,
  onSaved
}: {
  open: boolean;
  group: PlaylistDto | null;
  /** Grupo da biblioteca (administrador da plataforma). */
  library?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [media, setMedia] = useState<MediaDto[]>([]);
  const [screens, setScreens] = useState<ScreenDto[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [screenIds, setScreenIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setDescription(group?.description ?? "");
    setCategory(group?.category ?? "");
    setImageUrl(group?.imageUrl ?? null);
    setMediaIds(group?.items.map((item) => item.mediaId) ?? []);
    setIsActive(group?.isActive ?? true);
    setScreenIds([]);
    apiClient.listMedia().then(setMedia).catch(() => undefined);
    if (!library) {
      apiClient.listScreens().then(setScreens).catch(() => undefined);
      if (group) apiClient.getPlaylistScreens(group.id).then(setScreenIds).catch(() => undefined);
    }
  }, [group, library, open]);

  async function save() {
    if (!name.trim()) {
      toast({ title: "Informe o nome do grupo.", variant: "error" });
      return;
    }
    if (mediaIds.length === 0) {
      toast({ title: "Adicione pelo menos uma mídia.", variant: "error" });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        imageUrl,
        isActive,
        mediaIds,
        ...(library ? { isLibrary: true } : { screenIds })
      };
      if (group) await apiClient.updatePlaylist(group.id, payload);
      else await apiClient.createPlaylist(payload);
      toast({ title: group ? "Grupo atualizado" : "Grupo criado", variant: "success" });
      onSaved();
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
      size="xl"
      title={group ? `Editar grupo — ${group.name}` : library ? "Novo conteúdo da biblioteca" : "Novo grupo"}
      description="Um grupo entra na lista do terminal como um único item e toca as mídias na ordem abaixo."
    >
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-[auto_1fr]">
          <ImageUploadField hint="Capa 800x800" label="Imagem" onChange={setImageUrl} value={imageUrl} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" required>
              <Input onChange={(event) => setName(event.target.value)} placeholder="Ex.: Datas sazonais" value={name} />
            </Field>
            <Field label="Categoria">
              <Input onChange={(event) => setCategory(event.target.value)} placeholder="Ex.: Entretenimento" value={category} />
            </Field>
            <Field className="sm:col-span-2" label="Descrição">
              <Textarea className="min-h-16" onChange={(event) => setDescription(event.target.value)} value={description} />
            </Field>
          </div>
        </div>
        <Switch checked={isActive} description="Grupos inativos não tocam nos terminais." label="Grupo ativo" onChange={setIsActive} />
        <MediaOrderPicker media={media} onChange={setMediaIds} value={mediaIds} />
        {!library ? (
          <Field label="Incluir nos terminais">
            <ScreenPicker onChange={setScreenIds} screens={screens} value={screenIds} />
          </Field>
        ) : null}
        <p className="text-xs text-muted-foreground">As mídias só tocam em terminais que tenham a versão da orientação correspondente (ou uma única versão).</p>
      </div>
    </Modal>
  );
}
