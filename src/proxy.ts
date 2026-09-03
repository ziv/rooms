import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing, isLocale, DEFAULT_LOCALE } from "@/i18n/routing";
import { refreshSession } from "@/lib/supabase/proxy";

const intl = createIntlMiddleware(routing);

/** Paths (after the locale segment) that do not require a session. */
const PUBLIC_PATHS = ["/login", "/privacy", "/terms"];

function splitLocale(pathname: string): { locale: string | null; rest: string } {
  const [, first = "", ...restParts] = pathname.split("/");
  if (isLocale(first)) return { locale: first, rest: "/" + restParts.join("/") };
  return { locale: null, rest: pathname };
}

export async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const { pathname } = request.nextUrl;

  // API routes: no locale handling; just pass the request id through.
  if (pathname.startsWith("/api/")) {
    const headers = new Headers(request.headers);
    headers.set("x-request-id", requestId);
    return NextResponse.next({ request: { headers } });
  }

  const response = intl(request);
  response.headers.set("x-request-id", requestId);

  const user = await refreshSession(request, response);
  const { locale, rest } = splitLocale(pathname);
  const isPublic = PUBLIC_PATHS.some((p) => rest === p || rest.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale ?? DEFAULT_LOCALE}/login`;
    url.search = rest && rest !== "/" ? `?next=${encodeURIComponent(rest)}` : "";
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}

export const config = {
  // Skip static files and Next internals.
  matcher: ["/((?!_next|.*\\..*).*)"],
};
