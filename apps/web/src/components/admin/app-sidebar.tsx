"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Clock,
  CloudSun,
  DollarSign,
  FolderKanban,
  Home,
  Instagram,
  Library,
  ListVideo,
  Megaphone,
  Newspaper,
  Settings,
  Tv,
  Users,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useSession } from "@/components/layout/session-context";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  resellerOnly?: boolean;
}

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/screens", label: "Terminais", icon: Tv },
  { href: "/media", label: "Mídias", icon: ListVideo },
  { href: "/playlists", label: "Grupos", icon: FolderKanban },
  { href: "/library", label: "Biblioteca", icon: Library },
  { href: "/reports", label: "Relatórios", icon: BarChart3 }
];

const widgetNav: NavItem[] = [
  { href: "/widgets/clock", label: "Hora certa", icon: Clock },
  { href: "/widgets/currency", label: "Cotação", icon: DollarSign },
  { href: "/widgets/weather", label: "Clima", icon: CloudSun },
  { href: "/widgets/rss", label: "Notícias RSS", icon: Newspaper },
  { href: "/widgets/notice", label: "Avisos", icon: Megaphone },
  { href: "/widgets/instagram", label: "Instagram", icon: Instagram }
];

const adminNav: NavItem[] = [
  { href: "/companies", label: "Empresas", icon: Building2, adminOnly: true },
  { href: "/users", label: "Usuários", icon: Users, adminOnly: true },
  { href: "/accounts", label: "Clientes", icon: UsersRound, resellerOnly: true },
  { href: "/settings", label: "Configurações", icon: Settings }
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { session } = useSession();
  const isReseller = Boolean(session?.isSuperadmin || (session?.isAdmin && session.accounts.some((account) => account.kind === "reseller")));

  const visible = (item: NavItem) =>
    (!item.adminOnly || session?.isAdmin) && (!item.resellerOnly || isReseller);

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition",
          "hover:bg-white/5 hover:text-foreground",
          active && "bg-primary/10 text-primary ring-1 ring-primary/20"
        )}
        href={item.href}
        key={item.href}
        onClick={onNavigate}
      >
        <item.icon className="h-4 w-4" aria-hidden="true" />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="h-full border-white/10 bg-black/30 backdrop-blur-xl lg:min-h-screen lg:border-r">
      <div className="flex h-full flex-col overflow-y-auto pb-6">
        <div className="flex items-center gap-3 px-5 py-5">
          {session?.account.logoUrl ? (
            <img alt={session.account.name} className="h-10 max-w-[10rem] object-contain" src={session.account.logoUrl} />
          ) : (
            <BrandLogo imageClassName="shadow-lg shadow-primary/20" />
          )}
        </div>
        <nav className="grid gap-1 px-3">{mainNav.map(renderItem)}</nav>
        <p className="mt-5 px-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Conteúdos dinâmicos</p>
        <nav className="mt-2 grid gap-1 px-3">{widgetNav.map(renderItem)}</nav>
        <p className="mt-5 px-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Gestão</p>
        <nav className="mt-2 grid gap-1 px-3">{adminNav.filter(visible).map(renderItem)}</nav>
      </div>
    </aside>
  );
}
