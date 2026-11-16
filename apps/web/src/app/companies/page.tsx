"use client";

import { useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import type { CompanyDto } from "@dialindooh/shared";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { ErrorBanner } from "@/components/admin/error-banner";
import { IconButton } from "@/components/admin/pickers";
import { useToast } from "@/components/feedback/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Modal, PageActions, Table, Td, Th } from "@/components/ui/form";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

export default function CompaniesPage() {
  const { toast } = useToast();
  const companies = useApiQuery(apiClient.listCompanies, []);
  const [editing, setEditing] = useState<CompanyDto | "new" | null>(null);
  const [form, setForm] = useState({ name: "", document: "", contact: "", phone: "" });
  const [deleteTarget, setDeleteTarget] = useState<CompanyDto | null>(null);

  function open(company: CompanyDto | "new") {
    setEditing(company);
    setForm(
      company === "new"
        ? { name: "", document: "", contact: "", phone: "" }
        : { name: company.name, document: company.document ?? "", contact: company.contact ?? "", phone: company.phone ?? "" }
    );
  }

  async function save() {
    try {
      const payload = { name: form.name, document: form.document || null, contact: form.contact || null, phone: form.phone || null };
      if (editing === "new") await apiClient.createCompany(payload);
      else if (editing) await apiClient.updateCompany(editing.id, payload);
      setEditing(null);
      await companies.refresh({ silent: true });
      toast({ title: "Empresa salva", variant: "success" });
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.deleteCompany(deleteTarget.id);
      setDeleteTarget(null);
      await companies.refresh({ silent: true });
    } catch (error) {
      toast({ title: "Não foi possível excluir", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <AppShell description="Anunciantes e lojas donos das mídias e dos terminais. Use nos filtros e relatórios." title="Empresas">
      <PageActions>
        <p className="text-sm text-muted-foreground">{companies.data?.length ?? 0} empresa(s)</p>
        <Button onClick={() => open("new")} type="button">
          <Plus className="h-4 w-4" /> Nova empresa
        </Button>
      </PageActions>
      {companies.error ? <ErrorBanner message={companies.error} /> : null}
      {companies.data?.length === 0 ? <EmptyState description="Cadastre anunciantes para organizar mídias e relatórios." icon={Building2} title="Nenhuma empresa" /> : null}
      {companies.data?.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>CNPJ/CPF</Th>
              <Th>Contato</Th>
              <Th>Terminais</Th>
              <Th>Mídias</Th>
              <Th className="text-right">Opções</Th>
            </tr>
          </thead>
          <tbody>
            {companies.data.map((company) => (
              <tr key={company.id}>
                <Td className="font-medium">{company.name}</Td>
                <Td>{company.document ?? "—"}</Td>
                <Td>{[company.contact, company.phone].filter(Boolean).join(" · ") || "—"}</Td>
                <Td>{company.screenCount}</Td>
                <Td>{company.mediaCount}</Td>
                <Td className="text-right">
                  <div className="flex justify-end">
                    <IconButton label="Editar" onClick={() => open(company)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Excluir" onClick={() => setDeleteTarget(company)} tone="danger">
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
            <Button onClick={() => setEditing(null)} type="button" variant="ghost">
              Cancelar
            </Button>
            <Button disabled={!form.name.trim()} onClick={() => void save()} type="button">
              Salvar
            </Button>
          </>
        }
        onClose={() => setEditing(null)}
        open={Boolean(editing)}
        size="sm"
        title={editing === "new" ? "Nova empresa" : "Editar empresa"}
      >
        <div className="grid gap-3">
          <Field label="Nome" required>
            <Input onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} />
          </Field>
          <Field label="CNPJ/CPF">
            <Input onChange={(event) => setForm({ ...form, document: event.target.value })} value={form.document} />
          </Field>
          <Field label="Contato">
            <Input onChange={(event) => setForm({ ...form, contact: event.target.value })} value={form.contact} />
          </Field>
          <Field label="Telefone">
            <Input onChange={(event) => setForm({ ...form, phone: event.target.value })} value={form.phone} />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        confirmLabel="Excluir"
        description="Terminais e mídias dessa empresa ficarão sem empresa (não são apagados)."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        open={Boolean(deleteTarget)}
        title={`Excluir ${deleteTarget?.name}?`}
      />
    </AppShell>
  );
}
