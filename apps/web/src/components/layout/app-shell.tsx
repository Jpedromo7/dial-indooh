import { AppHeader } from "@/components/admin/app-header";
import { AppSidebar } from "@/components/admin/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <AppSidebar />
      <main className="min-w-0">
        <AppHeader />
        <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
