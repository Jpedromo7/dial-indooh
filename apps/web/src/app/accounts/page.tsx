"use client";

import { useState } from "react";
import { LogIn, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import type { AccountDto } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "@/components/layout/session-context";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { IconButton } from "@/components/admin/pickers";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input, Modal, PageActions, Select, Switch, Table, Td, Th } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { StrengthBar } from "@/components/admin/password-strength";

export default function AccountsPage() {
  const { toast } = useToast();
  const { session } = useSession();
  const accounts = useApiQuery(apiClient.listAccounts, []);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AccountDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountDto | null>(null);
  const [form, setForm] = useState({ name: "", kind: "client" as "client" | "reseller", maxScreens: "", maxInstagram: "5", adminName: "", adminEmail: "", adminPassword: "" });
  const [editForm, setEditForm] = useState({ name: "", isActive: true, maxScreens: "", maxInstagram: "5" });

  async function create() {
    try {
      await apiClient.createAccount({
        name: form.name,
        kind: form.kind,
        maxScreens: form.maxScreens ? Number(form.maxScreens) : null,
        maxInstagram: Number(form.maxInstagram) || 0,
        admin: { name: form.adminName, email: form.adminEmail, password: form.adminPassword }
      });
      setCreateOpen(false);
      await accounts.refresh({ silent: true });
      toast({ title: "Cliente criado", description: `Acesso: ${form.adminEmail}`, variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível criar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function update() {
    if (!editing) return;
    try {
      await apiClient.updateAccountAdmin(editing.id, {
        name: editForm.name,
        isActive: editForm.isActive,
        maxScreens: editForm.maxScreens ? Number(editForm.maxScreens) : null,
        maxInstagram: Number(editForm.maxInstagram) || 0
      });
      setEditing(null);
      await accounts.refresh({ silent: true });
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function enter(account: AccountDto) {
    await apiClient.switchAccount(account.id);
    window.location.href = "/dashboard";
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.deleteAccount(deleteTarget.id);
      setDeleteTarget(null);
      await accounts.refresh({ silent: true });
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <AppShell description="Contas dos seus clientes. Cada cliente tem os próprios terminais, mídias e usuários." title="Clientes">
      <PageActions>
        <p className="text-sm text-muted-foreground">{accounts.data?.length ?? 0} cliente(s)</p>
        <Button
          onClick={() => {
            setForm({ name: "", kind: "client", maxScreens: "", maxInstagram: "5", adminName: "", adminEmail: "", adminPassword: "" });
            setCreateOpen(true);
          }}
          type="button"
        >
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </PageActions>
      {accounts.error ? <ErrorBanner message={accounts.error} /> : null}
      {accounts.data?.length === 0 ? <EmptyState description="Crie contas para seus clientes gerenciarem as próprias telas." icon={UsersRound} title="Nenhum cliente" /> : null}
      {accounts.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Tipo</Th>
              <Th>Terminais</Th>
              <Th>Usuários</Th>
              <Th>Criado em</Th>
              <Th>Situação</Th>
              <Th className="text-right">Opções</Th>
            </tr>
          </thead>
          <tbody>
            {accounts.data.map((account) => (
              <tr key={account.id}>
                <Td className="font-medium">{account.name}</Td>
                <Td>{account.kind === "reseller" ? <Badge tone="accent">Revenda</Badge> : <Badge>Cliente</Badge>}</Td>
                <Td>
                  {account.screenCount ?? 0}
                  {account.maxScreens ? ` / ${account.maxScreens}` : ""}
                </Td>
                <Td>{account.userCount ?? 0}</Td>
                <Td className="text-xs text-muted-foreground">{formatDate(account.createdAt)}</Td>
                <Td>{account.isActive ? <Badge tone="success">Ativo</Badge> : <Badge tone="danger">Bloqueado</Badge>}</Td>
                <Td className="text-right">
                  <div className="flex justify-end">
                    <IconButton label="Entrar na conta" onClick={() => void enter(account)}>
                      <LogIn className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Editar"
                      onClick={() => {
                        setEditing(account);
                        setEditForm({ name: account.name, isActive: account.isActive, maxScreens: account.maxScreens ? String(account.maxScreens) : "", maxInstagram: String(account.maxInstagram) });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Excluir" onClick={() => setDeleteTarget(account)} tone="danger">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
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
            <Button onClick={() => setCreateOpen(false)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button onClick={() => void create()} type="button">
              Criar cliente
            </Button>
          </>
        }
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="Novo cliente"
      >
        <div className="grid gap-3">
          <Field label="Nome do cliente" required>
            <Input onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            {session?.isSuperadmin ? (
              <Field label="Tipo">
                <Select onChange={(event) => setForm({ ...form, kind: event.target.value as "client" | "reseller" })} value={form.kind}>
                  <option value="client">Cliente</option>
                  <option value="reseller">Revenda</option>
                </Select>
              </Field>
            ) : null}
            <Field hint="Vazio = ilimitado" label="Limite de terminais">
              <Input min={1} onChange={(event) => setForm({ ...form, maxScreens: event.target.value })} type="number" value={form.maxScreens} />
            </Field>
            <Field label="Contas Instagram">
              <Input min={0} onChange={(event) => setForm({ ...form, maxInstagram: event.target.value })} type="number" value={form.maxInstagram} />
            </Field>
          </div>
          <p className="mt-2 text-sm font-semibold">Administrador do cliente</p>
          <Field label="Nome" required>
            <Input onChange={(event) => setForm({ ...form, adminName: event.target.value })} value={form.adminName} />
          </Field>
          <Field label="E-mail" required>
            <Input onChange={(event) => setForm({ ...form, adminEmail: event.target.value })} type="email" value={form.adminEmail} />
          </Field>
          <Field hint="Mínimo 8 caracteres com letras e números." label="Senha inicial" required>
            <Input autoComplete="new-password" onChange={(event) => setForm({ ...form, adminPassword: event.target.value })} type="password" value={form.adminPassword} />
            <StrengthBar password={form.adminPassword} />
          </Field>
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <Button onClick={() => setEditing(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button onClick={() => void update()} type="button">
              Salvar
            </Button>
          </>
        }
        onClose={() => setEditing(null)}
        open={Boolean(editing)}
        size="sm"
        title="Editar cliente"
      >
        <div className="grid gap-3">
          <Field label="Nome">
            <Input onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} value={editForm.name} />
          </Field>
          <Field hint="Vazio = ilimitado" label="Limite de terminais">
            <Input onChange={(event) => setEditForm({ ...editForm, maxScreens: event.target.value })} type="number" value={editForm.maxScreens} />
          </Field>
          <Field label="Contas Instagram">
            <Input onChange={(event) => setEditForm({ ...editForm, maxInstagram: event.target.value })} type="number" value={editForm.maxInstagram} />
          </Field>
          <Switch checked={editForm.isActive} description="Cliente bloqueado não acessa o painel (as TVs continuam tocando)." label="Conta ativa" onChange={(value) => setEditForm({ ...editForm, isActive: value })} />
        </div>
      </Modal>
      <ConfirmDialog
        confirmLabel="Excluir cliente"
        description="Remove a conta, usuários, mídias e grupos do cliente. Só é permitido sem terminais cadastrados. Não pode ser desfeito."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        open={Boolean(deleteTarget)}
        title={`Excluir ${deleteTarget?.name}?`}
      />
    </AppShell>
  );
}
