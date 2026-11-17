"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: Laptop }
];

/** Seletor Claro / Escuro / Automático. `compact` mostra só os ícones (cabeçalho). */
export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div aria-label="Aparência" className={cn("inline-flex items-center gap-0.5 rounded-lg border bg-muted/60 p-0.5", className)} role="radiogroup">
      {options.map((option) => {
        const active = preference === option.value;
        return (
          <button
            aria-checked={active}
            aria-label={option.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors",
              compact ? "h-7 w-7 justify-center" : "h-8 px-3",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-card text-foreground shadow-sm"
            )}
            key={option.value}
            onClick={() => setPreference(option.value)}
            role="radio"
            title={option.label}
            type="button"
          >
            <option.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {compact ? null : option.label}
          </button>
        );
      })}
    </div>
  );
}
