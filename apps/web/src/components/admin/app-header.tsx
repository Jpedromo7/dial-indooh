"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

const titles: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Painel",
    description: "Visão geral da biblioteca de mídias, playlists e telas conectadas."
  },
  "/media": {
    title: "Mídias",
    description: "Envie, pesquise e gerencie imagens e vídeos."
  },
  "/playlists": {
    title: "Playlists",
    description: "Monte sequências de reprodução e controle agendamentos."
  },
  "/screens": {
    title: "Telas",
    description: "Cadastre dispositivos, atribua playlists e monitore o status."
  },
  "/settings": {
    title: "Configurações",
    description: "Configurações do espaço, armazenamento e administrador."
  }
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const fallbackPage = {
    title: "Painel",
    description: "Visão geral da biblioteca de mídias, playlists e telas conectadas."
  };
  const page = titles[pathname] ?? (pathname.startsWith("/playlists/") ? titles["/playlists"] : fallbackPage) ?? fallbackPage;

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-background/75 px-5 py-4 backdrop-blur-xl lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <BrandLogo
            className="mb-2 lg:hidden"
            imageClassName="h-6 w-6 rounded-sm"
            showText
            subtitleClassName="hidden"
            textClassName="text-xs uppercase text-muted-foreground"
          />
          <h1 className="truncate text-xl font-semibold tracking-normal lg:text-2xl">{page.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{page.description}</p>
        </div>
        <Button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            router.replace("/login");
          }}
          type="button"
          variant="ghost"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sair
        </Button>
      </div>
    </header>
  );
}
