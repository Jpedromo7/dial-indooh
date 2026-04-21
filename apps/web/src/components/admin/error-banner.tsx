import { CircleAlert } from "lucide-react";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <CircleAlert className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
