"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [branding, setBranding] = useState<{ name: string; logoUrl: string | null; loginImageUrl: string | null } | null>(null);

  useEffect(() => {
    apiClient.getBranding().then(setBranding).catch(() => undefined);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await apiClient.login(email, password);
      const next = searchParams.get("next");
      router.replace(next && isSafeRedirect(next) ? next : "/dashboard");
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Painel da marca: sempre escuro, nos dois temas. */}
      <div className="relative hidden overflow-hidden bg-[#050B1C] text-white lg:block">
        {branding?.loginImageUrl ? (
          <img alt="" className="absolute inset-0 h-full w-full object-cover" src={branding.loginImageUrl} />
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(137,24,232,0.22),transparent_45%),radial-gradient(circle_at_75%_70%,rgba(0,217,236,0.14),transparent_45%)]" />
            <div className="absolute inset-0 flex items-center justify-center pb-24">
              <img alt="" aria-hidden="true" className="h-56 w-56 object-contain opacity-95" src={BRAND.assets.symbol} />
            </div>
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050B1C] via-[#050B1C]/80 to-transparent p-10">
          <p className="text-3xl font-semibold tracking-tight">Sua mídia indoor, em todas as telas.</p>
          <p className="mt-2 max-w-md text-slate-300">Gerencie terminais, conteúdos, agendamentos e relatórios de exibição em um só lugar.</p>
        </div>
      </div>
      <div className="relative flex items-center justify-center px-6 py-10">
        <ThemeToggle className="absolute right-4 top-4" compact />
        <div className="w-full max-w-sm">
          {branding?.logoUrl ? (
            <img alt={branding.name} className="mb-8 h-14 object-contain" src={branding.logoUrl} />
          ) : (
            <BrandLogo className="mb-8" variant="lg" />
          )}
          <h1 className="text-2xl font-semibold">Entrar no painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use o e-mail e a senha cadastrados.</p>
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <Field label="E-mail">
              <Input autoComplete="username" autoFocus onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </Field>
            <Field label="Senha">
              <div className="relative">
                <Input
                  autoComplete="current-password"
                  className="pr-10"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p> : null}
            <Button className="h-11" disabled={isLoading} type="submit">
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

/** Aceita só caminhos internos ("/screens"), nunca "//site" ou "/\site". */
function isSafeRedirect(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !path.includes(":");
}
