"use client";

import { Cloud, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    title: "Perfil do administrador",
    icon: ShieldCheck,
    rows: ["Gerenciamento de nome e e-mail", "Troca de senha", "Política de funções e permissões"]
  },
  {
    title: "Configuração do aplicativo",
    icon: SlidersHorizontal,
    rows: ["Duração padrão das imagens", "Intervalo de sinal das TVs", "Tempo de tolerância para offline"]
  },
  {
    title: "Configuração de armazenamento",
    icon: Cloud,
    rows: ["URL pública/CDN", "Bucket de upload", "Provedor de processamento de vídeo"]
  }
];

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="grid gap-4 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Card className="bg-card/70" key={section.title}>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {section.rows.map((row) => (
                    <div className="rounded-md border bg-background/40 p-3 text-sm text-muted-foreground" key={row}>
                      {row}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
