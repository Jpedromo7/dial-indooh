"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, UserCircle } from "lucide-react";
import type { NotificationDto } from "@dialindooh/shared";
import { useSession } from "@/components/layout/session-context";
import { useToast } from "@/components/feedback/toast";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function AppHeader({ title, description, onOpenMenu }: { title: string; description?: string; onOpenMenu: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useSession();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      apiClient
        .getNotifications()
        .then((items) => active && setNotifications(items))
        .catch(() => undefined);
    void load();
    const interval = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session?.account.id]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  async function switchAccount(accountId: string) {
    try {
      await apiClient.switchAccount(accountId);
      window.location.reload();
    } catch (error) {
      toast({ title: "Não foi possível trocar de conta", description: getApiErrorMessage(error), variant: "error" });
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 px-4 py-3 backdrop-blur-xl lg:px-8">
      <div className="flex items-center justify-between gap-3" ref={panelRef}>
        <div className="flex min-w-0 items-center gap-3">
          <Button aria-label="Abrir menu" className="lg:hidden" onClick={onOpenMenu} size="icon" type="button" variant="ghost">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-normal lg:text-2xl">{title}</h1>
            {description ? <p className="hidden truncate text-sm text-muted-foreground sm:block">{description}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" compact />
          {session && session.accounts.length > 1 ? (
            <Select
              aria-label="Conta ativa"
              className="hidden h-9 w-48 md:block"
              onChange={(event) => void switchAccount(event.target.value)}
              value={session.account.id}
            >
              {session.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.kind === "reseller" ? "★ " : ""}
                  {account.name}
                </option>
              ))}
            </Select>
          ) : null}

          <div className="relative">
            <Button aria-label="Notificações" onClick={() => setShowNotifications((value) => !value)} size="icon" type="button" variant="ghost">
              <Bell className="h-5 w-5" />
              {notifications.length ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              ) : null}
            </Button>
            {showNotifications ? (
              <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-lg border bg-card p-2 shadow-2xl">
                <p className="px-2 py-1 text-sm font-semibold">Notificações</p>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">Tudo certo por aqui.</p> : null}
                  {notifications.map((notification) => (
                    <Link
                      className="block rounded-md px-2 py-2 hover:bg-muted/50"
                      href={notification.href ?? "#"}
                      key={notification.id}
                      onClick={() => setShowNotifications(false)}
                    >
                      <p className={cn("text-sm font-medium", notification.level === "error" ? "text-red-700 dark:text-red-300" : notification.level === "warn" ? "text-amber-700 dark:text-amber-300" : "")}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{notification.message}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              onClick={() => setShowUserMenu((value) => !value)}
              type="button"
            >
              {session?.user.avatarUrl ? (
                <img alt="" className="h-7 w-7 rounded-full object-cover" src={session.user.avatarUrl} />
              ) : (
                <UserCircle className="h-7 w-7 text-muted-foreground" />
              )}
              <span className="hidden max-w-[10rem] truncate font-medium sm:inline">{session?.user.name ?? "…"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {showUserMenu ? (
              <div className="absolute right-0 mt-2 w-60 rounded-lg border bg-card p-2 shadow-2xl">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{session?.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{session?.user.email}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">Conta: {session?.account.name}</p>
                </div>
                {session && session.accounts.length > 1 ? (
                  <Select
                    className="my-1 h-9 md:hidden"
                    onChange={(event) => void switchAccount(event.target.value)}
                    value={session.account.id}
                  >
                    {session.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 sm:hidden">
                  <span className="text-xs text-muted-foreground">Aparência</span>
                  <ThemeToggle compact />
                </div>
                <Link className="block rounded-md px-2 py-2 text-sm hover:bg-muted" href="/settings?tab=profile" onClick={() => setShowUserMenu(false)}>
                  Meu perfil
                </Link>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={async () => {
                    await apiClient.logout().catch(() => undefined);
                    router.replace("/login");
                  }}
                  type="button"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
