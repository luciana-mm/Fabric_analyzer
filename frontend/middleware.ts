/**
 * Middleware de proteção de rotas Server-Side (Edge) do Next.js.
 *
 * - Intercepta requisições para áreas restritas do Operador (`/painel/*`)
 *   e do Gestor (`/gestor/*`) antes mesmo da página ser renderizada.
 * - Verifica a presença do cookie de sessão HTTP-only (`app_session`).
 * - Caso o usuário não esteja autenticado, redireciona imediatamente
 *   para a tela de login (`/`), funcionando em conjunto com o `ProtectedRoute`
 *   (que valida o perfil/role específico no cliente).
 */

import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedPath =
    pathname.startsWith("/painel") || pathname.startsWith("/gestor");

  if (isProtectedPath) {
    const sessionCookie = request.cookies.get("app_session")?.value;
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};