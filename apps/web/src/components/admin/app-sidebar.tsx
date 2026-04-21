"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, ListVideo, Settings, Tv } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/media", label: "Media", icon: Library },
  { href: "/playlists", label: "Playlists", icon: ListVideo },
  { href: "/screens", label: "Screens", icon: Tv },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-white/10 bg-black/20 backdrop-blur-xl lg:min-h-screen lg:border-r">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-5 py-5">
          <BrandLogo imageClassName="shadow-lg shadow-primary/20" />
        </div>
        <nav className="grid gap-1 px-3">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition",
                  "hover:bg-white/5 hover:text-foreground",
                  active && "bg-primary/10 text-primary ring-1 ring-primary/20"
                )}
                href={item.href}
                key={item.href}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
