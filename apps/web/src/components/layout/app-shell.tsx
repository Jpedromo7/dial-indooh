"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AppHeader } from "@/components/admin/app-header";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { SessionProvider } from "@/components/layout/session-context";

export function AppShell({ children, title, description }: { children: React.ReactNode; title: string; description?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <SessionProvider>
      <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
        <div className="hidden lg:block">
          <div className="sticky top-0 h-screen">
            <AppSidebar />
          </div>
        </div>
        {menuOpen ? (
          <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="h-full w-72 max-w-[85vw] bg-background" onClick={(event) => event.stopPropagation()}>
              <button
                aria-label="Fechar menu"
                className="absolute left-[min(18rem,85vw)] top-3 ml-2 rounded-md bg-card p-2"
                onClick={() => setMenuOpen(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
              <AppSidebar onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        ) : null}
        <main className="min-w-0">
          <AppHeader description={description} onOpenMenu={() => setMenuOpen(true)} title={title} />
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}
