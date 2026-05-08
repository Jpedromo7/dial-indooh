import type { ScreenStatus } from "@dialindooh/shared";
import { cn } from "@/lib/utils";

const statusLabels: Record<ScreenStatus, string> = {
  online: "Online",
  offline: "Offline"
};

export function StatusBadge({ status }: { status: ScreenStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
        status === "online"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-muted bg-muted/60 text-muted-foreground"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "online" ? "bg-primary" : "bg-muted-foreground")} />
      {statusLabels[status]}
    </span>
  );
}
