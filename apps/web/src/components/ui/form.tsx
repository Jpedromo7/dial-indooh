"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full rounded-md border bg-background/60 px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputClass, className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(inputClass, "h-auto min-h-24 py-2", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(inputClass, "pr-8", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function Field({
  label,
  hint,
  required,
  className,
  children
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      aria-pressed={checked}
      className="flex items-center gap-3 text-left text-sm disabled:opacity-50"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition", checked ? "translate-x-5" : "translate-x-0.5")} />
      </span>
      {label ? (
        <span>
          <span className="font-medium">{label}</span>
          {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
        </span>
      ) : (
        <span className="text-muted-foreground">{checked ? "Sim" : "Não"}</span>
      )}
    </button>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          aria-label={label}
          className="h-10 w-14 cursor-pointer rounded-md border bg-transparent p-1"
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value}
        />
        <Input
          className="font-mono uppercase"
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      </div>
    </Field>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md"
}: {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-4" role="dialog">
      <div className={cn("flex max-h-[92vh] w-full flex-col rounded-t-xl border bg-card shadow-2xl shadow-black/40 sm:rounded-xl", width)}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <button aria-label="Fechar" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
  className
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "danger" | "warn" | "info" | "accent";
  className?: string;
}) {
  const tones = {
    default: "border-border bg-muted text-muted-foreground",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    accent: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
  };

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function PageActions({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-3">{children}</div>;
}

export function Tabs<T extends string>({
  value,
  onChange,
  options
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: React.ReactNode }>;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border bg-background/40 p-1">
      {options.map((option) => (
        <button
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition",
            value === option.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("border-b bg-muted/30 px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b px-3 py-2 align-middle", className)}>{children}</td>;
}
