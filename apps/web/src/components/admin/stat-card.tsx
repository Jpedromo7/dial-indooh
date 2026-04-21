import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  caption?: string;
}

export function StatCard({ label, value, icon: Icon, caption }: StatCardProps) {
  return (
    <Card className="border-white/10 bg-card/70 shadow-xl shadow-black/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        {caption ? <p className="mt-4 text-xs text-muted-foreground">{caption}</p> : null}
      </CardContent>
    </Card>
  );
}
