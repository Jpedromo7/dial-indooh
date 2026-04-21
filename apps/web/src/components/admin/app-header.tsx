"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const titles: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Dashboard",
    description: "Live overview of your media library, playlists, and screen fleet."
  },
  "/media": {
    title: "Media",
    description: "Upload, search, and manage image and video assets."
  },
  "/playlists": {
    title: "Playlists",
    description: "Build ordered playback loops and control active schedules."
  },
  "/screens": {
    title: "Screens",
    description: "Register devices, assign playlists, and monitor device health."
  },
  "/settings": {
    title: "Settings",
    description: "Workspace, storage, and administrator configuration."
  }
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const fallbackPage = {
    title: "Dashboard",
    description: "Live overview of your media library, playlists, and screen fleet."
  };
  const page = titles[pathname] ?? (pathname.startsWith("/playlists/") ? titles["/playlists"] : fallbackPage) ?? fallbackPage;

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-background/75 px-5 py-4 backdrop-blur-xl lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground lg:hidden">
            <Menu className="h-4 w-4" aria-hidden="true" />
            Admin
          </div>
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
          Sign out
        </Button>
      </div>
    </header>
  );
}
