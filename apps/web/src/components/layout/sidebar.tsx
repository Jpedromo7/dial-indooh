import Link from "next/link";
import {
  LayoutDashboard,
  Library,
  ListVideo,
  Settings,
  Tv
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/media", label: "Mídias", icon: Library },
  { href: "/playlists", label: "Playlists", icon: ListVideo },
  { href: "/screens", label: "Telas", icon: Tv },
  { href: "/settings", label: "Configurações", icon: Settings }
];

export function Sidebar() {
  return (
    <aside className="border-b bg-foreground text-background lg:min-h-screen lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-6 py-5">
          <BrandLogo subtitleClassName="text-background/60" textClassName="text-background" variant="sm" />
        </div>
        <nav className="grid gap-1 px-3 pb-4 lg:pb-0">
          {navigation.map((item) => (
            <Link
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-background/75 transition hover:bg-background/10 hover:text-background"
              )}
              href={item.href}
              key={item.href}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
