"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/feedback/toast";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("admin@dialindooh.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await apiClient.login(email, password);
      toast({ title: "Signed in", description: "Welcome back to Dial Indooh.", variant: "success" });
      router.replace("/dashboard");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-md border-white/10 bg-card/80 shadow-2xl shadow-black/30 backdrop-blur">
        <CardHeader className="space-y-4">
          <BrandLogo imageClassName="shadow-lg shadow-primary/20" variant="lg" />
          <div>
            <CardTitle className="text-2xl">Admin login</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">Manage media, playlists, and connected screens.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2 text-sm font-medium">
              <span>Email</span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setEmail(event.currentTarget.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>Password</span>
              <input
                className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                onChange={(event) => setPassword(event.currentTarget.value)}
                type="password"
                value={password}
              />
            </label>
            {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p> : null}
            <Button className="w-full" disabled={isLoading} type="submit">
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
