"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, UserCircle } from "lucide-react";
import type { UserDto } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "@/components/layout/session-context";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ErrorBanner } from "@/components/admin/error-banner";
import { IconButton, ImageUploadField, ScreenPicker } from "@/components/admin/pickers";
import { TIMEZONES } from "@/components/screens/screen-form";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input, Modal, PageActions, Select, Switch, Table, Td, Th } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage, type UserInput } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { StrengthBar } from "@/components/admin/password-strength";

const ROLE_LABELS = { superadmin: "Administrador da plataforma", admin: "Administrador", operator: "Operador" } as const;

export default function UsersPage() {
  const { toast } = useToast();
  const { session } = useSession();
  const users = useApiQuery(apiClient.listUsers, []);
  const screens = useApiQuery(() => apiClient.listScreens(), []);
  const [editing, setEditing] = useState<UserDto | "new" | null>(null);
  const [form, setForm] = useState<UserInput & { confirm?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);

  function open(user: UserDto | "new") {
    setEditing(user);
    setForm(
      user === "new"
        ? { name: "", email: "", password: "", confirm: "", role: "operator", timezone: "America/Sao_Paulo", restrictContent: false, screenIds: [], avatarUrl: null }
        : {
            name: user.name,
            email: user.email,
            role: user.role === "superadmin" ? undefined : user.role,
            timezone: user.timezone,
            restrictContent: user.restrictContent,
            screenIds: user.screenIds,
            avatarUrl: user.avatarUrl,
            isActive: user.isActive
          }
    );
  }

  async function save() {
    if (form.password && form.password !== form.confirm) {
      toast({ title: "As senhas não conferem.", variant: "error" });
      return;
    }

    try {
      const { confirm: _confirm, ...payload } = form;
      if (!payload.password) delete payload.password;
      if (editing === "new") await apiClient.createUser(payload);
      else if (editing) await apiClient.updateUser(editing.id, payload);
      setEditing(null);
      await users.refresh({ silent: true });
      toast({ title: "Usuário salvo", variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      await users.refresh({ silent: true });
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <AppShell description="Quem acessa o painel desta conta e quais terminais cada um enxerga." title="Usuários">
      <PageActions>
        <p className="text-sm text-muted-foreground">{users.data?.length ?? 0} usuário(s)</p>
        <Button onClick={() => open("new")} type="button">
          <Plus className="h-4 w-4" /> Novo usuário
        </Button>
      </PageActions>
      {users.error ? <ErrorBanner message={users.error} /> : null}
      {users.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Perfil</Th>
              <Th>Terminais</Th>
              <Th>Último acesso</Th>
              <Th>Situação</Th>
              <Th className="text-right">Opções</Th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((user) => (
              <tr key={user.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? <img alt="" className="h-8 w-8 rounded-full object-cover" src={user.avatarUrl} /> : <UserCircle className="h-8 w-8 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge tone={user.role === "operator" ? "default" : "accent"}>{ROLE_LABELS[user.role]}</Badge>
                </Td>
                <Td>{user.role === "operator" && user.restrictContent ? `${user.screenIds.length} liberado(s)` : "Todos"}</Td>
                <Td className="text-xs text-muted-foreground">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Nunca"}</Td>
                <Td>{user.isActive ? <Badge tone="success">Ativo</Badge> : <Badge tone="danger">Desativado</Badge>}</Td>
                <Td className="text-right">
                  <div className="flex justify-end">
                    {user.role !== "superadmin" || session?.isSuperadmin ? (
                      <IconButton label="Editar" onClick={() => open(user)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                    ) : null}
                    {user.id !== session?.user.id && user.role !== "superadmin" ? (
                      <IconButton label="Excluir" onClick={() => setDeleteTarget(user)} tone="danger">
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}

      <Modal
        footer={
          <>
            <Button onClick={() => setEditing(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button onClick={() => void save()} type="button">
              Salvar
            </Button>
          </>
        }
        onClose={() => setEditing(null)}
        open={Boolean(editing)}
        size="lg"
        title={editing === "new" ? "Novo usuário" : "Editar usuário"}
      >
        <div className="grid gap-4">
          <ImageUploadField label="Foto" onChange={(url) => setForm({ ...form, avatarUrl: url })} value={form.avatarUrl ?? null} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" required>
              <Input onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name ?? ""} />
            </Field>
            <Field label="E-mail" required>
              <Input onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" value={form.email ?? ""} />
            </Field>
            <Field hint="Mínimo 8 caracteres com letras e números." label={editing === "new" ? "Senha" : "Nova senha (opcional)"} required={editing === "new"}>
              <Input autoComplete="new-password" onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" value={form.password ?? ""} />
              <StrengthBar password={form.password ?? ""} />
            </Field>
            <Field label="Confirmar senha" required={editing === "new"}>
              <Input autoComplete="new-password" onChange={(event) => setForm({ ...form, confirm: event.target.value })} type="password" value={form.confirm ?? ""} />
            </Field>
            {form.role ? (
              <Field label="Perfil">
                <Select onChange={(event) => setForm({ ...form, role: event.target.value as "admin" | "operator" })} value={form.role}>
                  <option value="operator">Operador (gerencia conteúdo)</option>
                  <option value="admin">Administrador (tudo)</option>
                </Select>
              </Field>
            ) : null}
            <Field label="Fuso horário">
              <Select onChange={(event) => setForm({ ...form, timezone: event.target.value })} value={form.timezone ?? "America/Sao_Paulo"}>
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace("America/", "").replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {editing !== "new" ? <Switch checked={form.isActive ?? true} label="Usuário ativo" onChange={(value) => setForm({ ...form, isActive: value })} /> : null}
          {form.role === "operator" ? (
            <>
              <Switch
                checked={Boolean(form.restrictContent)}
                description="O operador só vê e gerencia os terminais marcados abaixo."
                label="Restringir terminais"
                onChange={(value) => setForm({ ...form, restrictContent: value })}
              />
              {form.restrictContent ? (
                <ScreenPicker onChange={(screenIds) => setForm({ ...form, screenIds })} screens={screens.data ?? []} value={form.screenIds ?? []} />
              ) : null}
            </>
          ) : null}
        </div>
      </Modal>
      <ConfirmDialog
        confirmLabel="Excluir"
        description="O usuário perderá o acesso ao painel imediatamente."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        open={Boolean(deleteTarget)}
        title={`Excluir ${deleteTarget?.name}?`}
      />
    </AppShell>
  );
}
