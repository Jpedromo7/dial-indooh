import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/apk", "/instalar"];

/** Redireciona para o login quem abre páginas do painel sem sessão (as APIs validam o token de verdade). */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (!request.cookies.get("dial_indooh_admin")?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|brand|favicon.ico|manifest.webmanifest|.*\.(?:png|jpg|svg|ico|webp)$).*)"]
};
